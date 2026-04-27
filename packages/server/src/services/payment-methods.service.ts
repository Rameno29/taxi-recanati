import Stripe from "stripe";
import db from "../db";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { getOrCreateStripeCustomer } from "./stripe-customer.service";

let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    if (!config.stripe.secretKey) {
      throw new AppError(500, "Stripe is not configured");
    }
    stripe = new Stripe(config.stripe.secretKey);
  }
  return stripe;
}

export function setStripeInstance(instance: Stripe | null) {
  stripe = instance;
}

export interface SavedPaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  wallet_type: string | null;
  paypal_email: string | null;
  is_default: boolean;
  created_at: string;
}

/**
 * List payment methods the user has saved.
 * Returns our local mirror (not Stripe directly) for speed. The mirror is
 * kept in sync by the webhook + explicit sync on add/delete.
 */
export async function listPaymentMethods(
  userId: string
): Promise<SavedPaymentMethod[]> {
  return db("payment_methods")
    .where("user_id", userId)
    .orderBy([
      { column: "is_default", order: "desc" },
      { column: "created_at", order: "desc" },
    ]);
}

/**
 * Creates a SetupIntent for this user (used to save a card without paying).
 * The client uses the returned client_secret with Stripe's PaymentSheet in
 * setup mode or confirmSetupIntent.
 */
export async function createSetupIntent(userId: string): Promise<{
  client_secret: string;
  customer: string;
  ephemeral_key: string;
}> {
  const customerId = await getOrCreateStripeCustomer(userId);
  const s = getStripe();

  const setupIntent = await s.setupIntents.create({
    customer: customerId,
    // payment_method_types defaults to ['card'] + anything enabled in Dashboard;
    // letting Stripe choose via automatic_payment_methods enables Apple/Google
    // Pay and PayPal automatically based on the PaymentSheet's capabilities.
    automatic_payment_methods: { enabled: true },
    usage: "off_session",
  });

  const ephemeral = await s.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: "2024-09-30.acacia" }
  );

  return {
    client_secret: setupIntent.client_secret as string,
    customer: customerId,
    ephemeral_key: ephemeral.secret as string,
  };
}

/**
 * After the client successfully confirms a SetupIntent, it posts the resulting
 * payment method id here so we can mirror it locally. We also accept being
 * called with a payment method id returned by a PaymentIntent confirmation
 * (when the user ticked "save for later" during checkout).
 */
export async function syncPaymentMethod(
  userId: string,
  stripePaymentMethodId: string
): Promise<SavedPaymentMethod> {
  const s = getStripe();
  const customerId = await getOrCreateStripeCustomer(userId);

  // Attach to customer if not already attached. Calling attach on an already
  // attached method returns the same object, but if it's attached to another
  // customer it throws — which is fine, that would be a data integrity issue.
  const pm = await s.paymentMethods.retrieve(stripePaymentMethodId);
  if (pm.customer !== customerId) {
    await s.paymentMethods.attach(stripePaymentMethodId, {
      customer: customerId,
    });
  }

  // Re-retrieve after attach to get the latest state
  const fresh = await s.paymentMethods.retrieve(stripePaymentMethodId);

  const existing = await db("payment_methods")
    .where("stripe_payment_method_id", stripePaymentMethodId)
    .first();

  const row = {
    user_id: userId,
    stripe_payment_method_id: stripePaymentMethodId,
    type: fresh.type,
    brand: fresh.card?.brand || null,
    last4: fresh.card?.last4 || null,
    exp_month: fresh.card?.exp_month || null,
    exp_year: fresh.card?.exp_year || null,
    wallet_type: fresh.card?.wallet?.type || null,
    paypal_email: (fresh as any).paypal?.payer_email || null,
  };

  if (existing) {
    const [updated] = await db("payment_methods")
      .where("id", existing.id)
      .update(row)
      .returning("*");
    return updated;
  }

  // First method → auto-mark as default
  const hasExisting = await db("payment_methods")
    .where("user_id", userId)
    .count<{ count: string }>({ count: "*" })
    .first();
  const count = Number(hasExisting?.count || 0);

  const [inserted] = await db("payment_methods")
    .insert({ ...row, is_default: count === 0 })
    .returning("*");

  return inserted;
}

/**
 * Detaches a payment method from Stripe and removes the local row.
 * If the removed method was the default, auto-promotes the next most recent.
 */
export async function deletePaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<{ deleted: true }> {
  const pm = await db("payment_methods")
    .where({ id: paymentMethodId, user_id: userId })
    .first();
  if (!pm) throw new AppError(404, "Payment method not found");

  const s = getStripe();
  try {
    await s.paymentMethods.detach(pm.stripe_payment_method_id);
  } catch (err: any) {
    // Already detached? Continue with local cleanup.
    if (err?.code !== "resource_missing") {
      throw err;
    }
  }

  await db.transaction(async (trx) => {
    await trx("payment_methods").where("id", pm.id).delete();

    if (pm.is_default) {
      // Promote the most recently added remaining method as default
      const next = await trx("payment_methods")
        .where("user_id", userId)
        .orderBy("created_at", "desc")
        .first();
      if (next) {
        await trx("payment_methods")
          .where("id", next.id)
          .update({ is_default: true });
      }
    }
  });

  return { deleted: true };
}

/**
 * Marks a method as default and clears the flag on all others.
 * Also sets the Customer's invoice_settings.default_payment_method so that
 * off_session charges (recurring, scheduled rides) use it automatically.
 */
export async function setDefaultPaymentMethod(
  userId: string,
  paymentMethodId: string
): Promise<SavedPaymentMethod> {
  const pm = await db("payment_methods")
    .where({ id: paymentMethodId, user_id: userId })
    .first();
  if (!pm) throw new AppError(404, "Payment method not found");

  await db.transaction(async (trx) => {
    await trx("payment_methods")
      .where("user_id", userId)
      .update({ is_default: false });
    await trx("payment_methods")
      .where("id", paymentMethodId)
      .update({ is_default: true });
  });

  // Sync with Stripe Customer object
  const customerId = await getOrCreateStripeCustomer(userId);
  const s = getStripe();
  await s.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: pm.stripe_payment_method_id,
    },
  });

  return db("payment_methods").where("id", paymentMethodId).first();
}

/**
 * Get the default payment method for a user, or null if none set.
 */
export async function getDefaultPaymentMethod(
  userId: string
): Promise<SavedPaymentMethod | null> {
  const pm = await db("payment_methods")
    .where({ user_id: userId, is_default: true })
    .first();
  return pm || null;
}
