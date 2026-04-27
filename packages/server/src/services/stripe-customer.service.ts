import Stripe from "stripe";
import db from "../db";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";

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

// Test hook
export function setStripeInstance(instance: Stripe | null) {
  stripe = instance;
}

/**
 * Lazy-creates a Stripe Customer for a user and persists the id on users.
 * Idempotent: if the user already has a stripe_customer_id, returns it without
 * hitting Stripe again.
 */
export async function getOrCreateStripeCustomer(
  userId: string
): Promise<string> {
  const user = await db("users").where("id", userId).first();
  if (!user) throw new AppError(404, "User not found");

  if (user.stripe_customer_id) {
    return user.stripe_customer_id as string;
  }

  const s = getStripe();
  const customer = await s.customers.create({
    email: user.email || undefined,
    phone: user.phone || undefined,
    name: user.name || undefined,
    metadata: { user_id: userId },
  });

  await db("users")
    .where("id", userId)
    .update({ stripe_customer_id: customer.id });

  return customer.id;
}

/**
 * Creates an ephemeral key the Stripe Payment Sheet needs to fetch/modify the
 * Customer client-side (required for showing saved payment methods).
 * The key is short-lived (typically ~1h) and scoped to one Customer.
 */
export async function createEphemeralKey(
  userId: string,
  stripeApiVersion: string
): Promise<{ customer: string; ephemeralKey: string }> {
  const customerId = await getOrCreateStripeCustomer(userId);
  const s = getStripe();

  // stripe-node requires passing the API version as a header via the second arg
  const key = await s.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: stripeApiVersion }
  );

  return { customer: customerId, ephemeralKey: key.secret as string };
}
