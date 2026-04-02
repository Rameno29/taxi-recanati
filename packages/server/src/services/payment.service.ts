import Stripe from "stripe";
import db from "../db";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";

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
 */
export async function createPaymentIntent(rideId: string, customerId: string) {
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

  const paymentIntent = await s.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    capture_method: "manual",
    metadata: {
      ride_id: rideId,
      customer_id: customerId,
    },
  });

  const [payment] = await db("payments")
    .insert({
      ride_id: rideId,
      provider: "stripe",
      stripe_payment_intent_id: paymentIntent.id,
      amount: ride.fare_estimate,
      currency: "EUR",
      status: "pending",
      metadata_json: JSON.stringify({ client_secret: paymentIntent.client_secret }),
    })
    .returning("*");

  return {
    ...payment,
    client_secret: paymentIntent.client_secret,
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
  }

  return { status: "processed", type: event.type };
}

/**
 * Get payment details for a ride.
 */
export async function getPaymentByRide(rideId: string) {
  return db("payments").where("ride_id", rideId).first();
}
