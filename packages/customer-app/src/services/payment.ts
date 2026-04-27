import { api } from "./api";

export interface PaymentIntent {
  id: string;
  ride_id: string;
  provider: string;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
}

export interface PaymentStatus {
  id: string;
  ride_id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  captured_amount: number | null;
  refunded_amount: number | null;
  paid_at: string | null;
}

/**
 * Create a Stripe PaymentIntent for a ride (authorize, not capture).
 * Returns the payment record including the client_secret needed by the PaymentSheet.
 */
export async function createPaymentIntent(
  rideId: string,
  savedPaymentMethodId?: string
): Promise<PaymentIntent & { status_stripe?: string }> {
  const body: { rideId: string; savedPaymentMethodId?: string } = { rideId };
  if (savedPaymentMethodId) body.savedPaymentMethodId = savedPaymentMethodId;

  const res = await api.post("/api/payments/create-intent", body);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to create payment intent");
  }

  return res.json();
}

/**
 * Get the current payment status for a ride.
 */
export async function getPaymentStatus(
  rideId: string
): Promise<PaymentStatus> {
  const res = await api.get(`/api/payments/ride/${rideId}`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to get payment status");
  }

  return res.json();
}

/**
 * Confirm payment authorization on the server side.
 */
export async function confirmPaymentOnServer(
  paymentId: string
): Promise<PaymentStatus> {
  const res = await api.post(`/api/payments/${paymentId}/confirm`);

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to confirm payment");
  }

  return res.json();
}
