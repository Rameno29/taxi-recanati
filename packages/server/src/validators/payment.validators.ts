import { z } from "zod";

export const createPaymentSchema = z.object({
  rideId: z.string().uuid(),
  // Optional — when present, pay with a saved method (one-tap, off_session).
  savedPaymentMethodId: z.string().uuid().optional(),
});

export const refundPaymentSchema = z.object({
  rideId: z.string().uuid(),
  amount: z.number().positive().optional(),
});

export const syncPaymentMethodSchema = z.object({
  // Stripe PaymentMethod id returned by the client after confirming a
  // SetupIntent or a PaymentIntent with setup_future_usage.
  stripePaymentMethodId: z.string().min(1),
});
