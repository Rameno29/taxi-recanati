import { api } from "./api";

export interface SavedPaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  type: string; // "card" | "paypal" | "apple_pay" | "google_pay" | ...
  brand: string | null; // "visa" | "mastercard" | ...
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  wallet_type: string | null; // "apple_pay" | "google_pay" | null
  paypal_email: string | null;
  is_default: boolean;
  created_at: string;
}

export interface SetupIntentData {
  client_secret: string;
  customer: string;
  ephemeral_key: string;
}

export interface EphemeralKeyData {
  customer: string;
  ephemeralKey: string;
}

export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const res = await api.get("/api/payments/methods");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to load payment methods");
  }
  return res.json();
}

export async function createSetupIntent(): Promise<SetupIntentData> {
  const res = await api.post("/api/payments/setup-intent");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create setup intent");
  }
  return res.json();
}

export async function createEphemeralKey(): Promise<EphemeralKeyData> {
  const res = await api.post("/api/payments/ephemeral-key");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create ephemeral key");
  }
  return res.json();
}

export async function syncPaymentMethod(
  stripePaymentMethodId: string
): Promise<SavedPaymentMethod> {
  const res = await api.post("/api/payments/methods", {
    stripePaymentMethodId,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to save payment method");
  }
  return res.json();
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const res = await api.del(`/api/payments/methods/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete payment method");
  }
}

export async function setDefaultPaymentMethod(
  id: string
): Promise<SavedPaymentMethod> {
  const res = await api.post(`/api/payments/methods/${id}/set-default`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to set default method");
  }
  return res.json();
}

/**
 * Human-readable label for a saved method.
 *   • Visa •• 4242
 *   • Apple Pay (Visa •• 4242)
 *   • PayPal (user@example.com)
 */
export function formatMethodLabel(m: SavedPaymentMethod): string {
  if (m.type === "paypal") {
    return m.paypal_email ? `PayPal (${m.paypal_email})` : "PayPal";
  }
  if (m.wallet_type === "apple_pay") {
    const suffix = m.last4 ? ` (${capitalize(m.brand)} •• ${m.last4})` : "";
    return `Apple Pay${suffix}`;
  }
  if (m.wallet_type === "google_pay") {
    const suffix = m.last4 ? ` (${capitalize(m.brand)} •• ${m.last4})` : "";
    return `Google Pay${suffix}`;
  }
  if (m.type === "card" && m.last4) {
    return `${capitalize(m.brand)} •• ${m.last4}`;
  }
  return capitalize(m.type);
}

/**
 * Ionicon name to display alongside a method.
 */
export function iconForMethod(m: SavedPaymentMethod): string {
  if (m.type === "paypal") return "logo-paypal";
  if (m.wallet_type === "apple_pay") return "logo-apple";
  if (m.wallet_type === "google_pay") return "logo-google";
  if (m.type === "card") return "card-outline";
  return "wallet-outline";
}

function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
