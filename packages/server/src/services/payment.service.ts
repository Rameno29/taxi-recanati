import Stripe from "stripe";
import db from "../db";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { getOrCreateStripeCustomer } from "./stripe-customer.service";
import { syncPaymentMethod } from "./payment-methods.service";
// Lazy-loaded to avoid circular import with ride.service → payment.service.
async function activateRideIfPending(rideId: string, customerId: string) {
  const { activateRide } = await import("./ride.service");
  try {
    await activateRide(rideId, customerId);
  } catch {
    // Already activated or other transient issue — client-side call will
    // retry. Webhook is best-effort.
  }
}

// Initialize Stripe (lazy — only when secret key is configured)
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

// For testing — allow injecting a mock Stripe instance
export function setStripeInstance(instance: Stripe | null) {
  stripe = instance;
}

/**
 * Create a Stripe PaymentIntent and record it in the payments table.
 * Uses manual capture (authorize now, capture on ride completion).
 *
 * When `savedPaymentMethodId` is provided, the intent is created with
 * `payment_method` + `confirm: true` + `off_session: true` so the charge
 * happens silently without opening the Payment Sheet — this is the
 * "one-tap with saved method" flow.
 *
 * Otherwise, returns a client_secret that the mobile app uses to open the
 * Payment Sheet (card / Apple Pay / Google Pay / PayPal).
 */
export async function createPaymentIntent(
  rideId: string,
  customerId: string,
  savedPaymentMethodId?: string
) {
  const ride = await db("rides").where("id", rideId).first();
  if (!ride) throw new AppError(404, "Ride not found");
  if (ride.customer_id !== customerId) {
    throw new AppError(403, "Not authorized to pay for this ride");
  }

  // Check if payment already exists for this ride
  const existing = await db("payments").where("ride_id", rideId).first();
  if (existing && existing.status !== "failed") {
    return existing;
  }

  const amountCents = Math.round(Number(ride.fare_estimate) * 100);
  const s = getStripe();
  const stripeCustomerId = await getOrCreateStripeCustomer(customerId);

  // Base params — attach to Customer so saved methods are available in the
  // Payment Sheet and the webhook flow is linked to the right user.
  const params: Stripe.PaymentIntentCreateParams = {
    amount: amountCents,
    currency: "eur",
    capture_method: "manual",
    customer: stripeCustomerId,
    metadata: {
      ride_id: rideId,
      customer_id: customerId,
    },
  };

  if (savedPaymentMethodId) {
    // Resolve our local row → stripe payment method id. Verify ownership.
    const pm = await db("payment_methods")
      .where({ id: savedPaymentMethodId, user_id: customerId })
      .first();
    if (!pm) throw new AppError(404, "Saved payment method not found");

    params.payment_method = pm.stripe_payment_method_id;
    params.confirm = true;
    params.off_session = true;
    // Off-session requires explicit payment method types (automatic_payment_methods
    // can't be combined with off_session).
    params.payment_method_types = [pm.type];
  } else {
    // Interactive flow — let Stripe pick methods based on Dashboard config.
    // This enables card + Apple Pay + Google Pay + PayPal (when enabled).
    params.automatic_payment_methods = { enabled: true };
    // We want to keep manual capture, so disallow redirect methods that
    // can't be captured later. The main redirect method that CAN be captured
    // in EUR in the EU is PayPal, so we allow redirects.
    // (If you want to disallow PayPal entirely, set this to "never".)
    // See: https://stripe.com/docs/payments/save-during-payment
    params.setup_future_usage = "off_session";
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await s.paymentIntents.create(params);
  } catch (err: any) {
    // Typical off_session failure: card requires 3DS re-auth
    if (err?.code === "authentication_required") {
      throw new AppError(
        402,
        "Questo metodo richiede una nuova autenticazione. Ripeti il pagamento."
      );
    }
    throw err;
  }

  const [payment] = await db("payments")
    .insert({
      ride_id: rideId,
      provider: "stripe",
      stripe_payment_intent_id: paymentIntent.id,
      amount: ride.fare_estimate,
      currency: "EUR",
      status:
        paymentIntent.status === "requires_capture" ? "authorized" : "pending",
      payment_method_type: savedPaymentMethodId ? "saved" : null,
      metadata_json: JSON.stringify({
        client_secret: paymentIntent.client_secret,
        used_saved_method: Boolean(savedPaymentMethodId),
      }),
    })
    .returning("*");

  if (paymentIntent.status === "requires_capture") {
    await db("rides")
      .where("id", rideId)
      .update({ payment_status: "authorized" });
  }

  return {
    ...payment,
    client_secret: paymentIntent.client_secret,
    status_stripe: paymentIntent.status,
  };
}

/**
 * Confirm that a payment has been authorized (called after client-side confirmation).
 */
export async function confirmPayment(paymentId: string) {
  const payment = await db("payments").where("id", paymentId).first();
  if (!payment) throw new AppError(404, "Payment not found");

  if (payment.status !== "pending") {
    throw new AppError(409, `Payment is already ${payment.status}`);
  }

  const s = getStripe();
  const pi = await s.paymentIntents.retrieve(payment.stripe_payment_intent_id);

  if (pi.status === "requires_capture") {
    const [updated] = await db("payments")
      .where("id", paymentId)
      .update({ status: "authorized" })
      .returning("*");

    // Update ride payment status
    await db("rides")
      .where("id", payment.ride_id)
      .update({ payment_status: "authorized" });

    return updated;
  }

  if (pi.status === "succeeded") {
    const [updated] = await db("payments")
      .where("id", paymentId)
      .update({
        status: "captured",
        captured_amount: payment.amount,
        paid_at: new Date(),
      })
      .returning("*");

    await db("rides")
      .where("id", payment.ride_id)
      .update({ payment_status: "captured" });

    return updated;
  }

  throw new AppError(400, `Unexpected PaymentIntent status: ${pi.status}`);
}

/**
 * Capture an authorized payment (called when ride is completed).
 * Captures the final fare amount (may differ from estimate).
 */
export async function capturePayment(rideId: string) {
  const payment = await db("payments")
    .where("ride_id", rideId)
    .where("status", "authorized")
    .first();

  if (!payment) throw new AppError(404, "No authorized payment found for this ride");

  const ride = await db("rides").where("id", rideId).first();
  const finalAmount = ride?.fare_final || payment.amount;
  const amountCents = Math.round(Number(finalAmount) * 100);

  const s = getStripe();
  await s.paymentIntents.capture(payment.stripe_payment_intent_id, {
    amount_to_capture: amountCents,
  });

  const [updated] = await db("payments")
    .where("id", payment.id)
    .update({
      status: "captured",
      captured_amount: finalAmount,
      paid_at: new Date(),
    })
    .returning("*");

  await db("rides")
    .where("id", rideId)
    .update({ payment_status: "captured" });

  return updated;
}

/**
 * Cancel an authorized (but not yet captured) PaymentIntent. This releases
 * the hold on the customer's payment method — they'll see the authorization
 * drop off within a few business days. Idempotent: if the payment is already
 * captured or cancelled, returns silently.
 *
 * Called when a ride is cancelled/expired before completion.
 */
export async function cancelAuthorizedPayment(rideId: string) {
  const payment = await db("payments").where("ride_id", rideId).first();
  if (!payment) return null; // no payment → nothing to cancel

  // Only cancel if we still have an uncaptured authorization.
  if (!["pending", "authorized"].includes(payment.status)) {
    return payment;
  }
  if (!payment.stripe_payment_intent_id) return payment;

  const s = getStripe();
  try {
    await s.paymentIntents.cancel(payment.stripe_payment_intent_id);
  } catch (err: any) {
    // If Stripe says the PI is already in a terminal state (already captured,
    // already cancelled, or never confirmed), treat it as success — we just
    // need to reflect that in our DB.
    const code = err?.code || err?.raw?.code;
    if (
      code !== "payment_intent_unexpected_state" &&
      code !== "resource_missing"
    ) {
      throw err;
    }
  }

  const [updated] = await db("payments")
    .where("id", payment.id)
    .update({ status: "failed", failure_reason: "cancelled_before_capture" })
    .returning("*");

  await db("rides").where("id", rideId).update({ payment_status: "failed" });

  return updated;
}

/**
 * Refund a captured payment (full or partial).
 */
export async function refundPayment(rideId: string, amount?: number) {
  const payment = await db("payments")
    .where("ride_id", rideId)
    .where("status", "captured")
    .first();

  if (!payment) throw new AppError(404, "No captured payment found for this ride");

  const refundAmount = amount || Number(payment.captured_amount);
  const refundCents = Math.round(refundAmount * 100);

  const s = getStripe();
  await s.refunds.create({
    payment_intent: payment.stripe_payment_intent_id,
    amount: refundCents,
  });

  const newRefunded = Number(payment.refunded_amount) + refundAmount;
  const newStatus = newRefunded >= Number(payment.captured_amount) ? "refunded" : "captured";

  const [updated] = await db("payments")
    .where("id", payment.id)
    .update({
      refunded_amount: newRefunded,
      status: newStatus,
    })
    .returning("*");

  if (newStatus === "refunded") {
    await db("rides")
      .where("id", rideId)
      .update({ payment_status: "refunded" });
  }

  return updated;
}

/**
 * Handle Stripe webhook events.
 */
export async function handleWebhook(rawBody: Buffer, signature: string) {
  const s = getStripe();

  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret
    );
  } catch {
    throw new AppError(400, "Invalid webhook signature");
  }

  // Idempotency check
  const existing = await db("payments")
    .where("webhook_event_id", event.id)
    .first();
  if (existing) return { status: "already_processed" };

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await db("payments")
        .where("stripe_payment_intent_id", pi.id)
        .update({
          status: "captured",
          captured_amount: pi.amount_received / 100,
          paid_at: new Date(),
          webhook_event_id: event.id,
        });
      break;
    }

    case "payment_intent.amount_capturable_updated": {
      // Fires when a manual-capture PI has been authorized. Activate the
      // ride defensively (in case the client never called /activate).
      const pi = event.data.object as Stripe.PaymentIntent;
      const rideId = pi.metadata?.ride_id;
      const customerId = pi.metadata?.customer_id;
      await db("payments")
        .where("stripe_payment_intent_id", pi.id)
        .update({ status: "authorized", webhook_event_id: event.id });
      if (rideId && customerId) {
        await activateRideIfPending(rideId, customerId);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await db("payments")
        .where("stripe_payment_intent_id", pi.id)
        .update({
          status: "failed",
          failure_reason: pi.last_payment_error?.message || "Payment failed",
          webhook_event_id: event.id,
        });
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        const piId = typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent.id;
        await db("payments")
          .where("stripe_payment_intent_id", piId)
          .update({
            status: "refunded",
            refunded_amount: (charge.amount_refunded || 0) / 100,
            webhook_event_id: event.id,
          });
      }
      break;
    }

    case "setup_intent.succeeded": {
      // User completed a "save card" flow. Mirror the payment method locally.
      const si = event.data.object as Stripe.SetupIntent;
      const userId = (si.metadata?.user_id as string) || null;
      const pmId = typeof si.payment_method === "string"
        ? si.payment_method
        : si.payment_method?.id;
      if (userId && pmId) {
        try {
          await syncPaymentMethod(userId, pmId);
        } catch (e) {
          // Already synced via explicit client post — ignore
        }
      }
      break;
    }

    case "payment_method.attached": {
      // Defensive: if a method was attached via another channel (e.g. Stripe
      // Dashboard) mirror it locally so the UI stays consistent.
      const pm = event.data.object as Stripe.PaymentMethod;
      const customerId = typeof pm.customer === "string"
        ? pm.customer
        : pm.customer?.id;
      if (customerId) {
        const user = await db("users")
          .where("stripe_customer_id", customerId)
          .first();
        if (user) {
          try {
            await syncPaymentMethod(user.id, pm.id);
          } catch (e) { /* ignore */ }
        }
      }
      break;
    }

    case "payment_method.detached": {
      // Mirror detach (e.g. user removed the card from another device or
      // Stripe invalidated it).
      const pm = event.data.object as Stripe.PaymentMethod;
      await db("payment_methods")
        .where("stripe_payment_method_id", pm.id)
        .delete();
      break;
    }
  }

  return { status: "processed", type: event.type };
}

/**
 * Get payment details for a ride.
 */
export async function getPaymentByRide(rideId: string) {
  return db("payments").where("ride_id", rideId).first();
}
