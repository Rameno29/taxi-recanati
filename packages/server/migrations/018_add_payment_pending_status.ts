import type { Knex } from "knex";

/**
 * Add "payment_pending" to the ride_status enum.
 *
 * Rides start in this status while the customer authorizes the Stripe
 * PaymentIntent. Once the PI reaches requires_capture, the server transitions
 * the ride to "pending" and runs dispatch. This prevents drivers from seeing
 * (and accepting) rides that haven't been paid for yet.
 */
export async function up(knex: Knex): Promise<void> {
  // ALTER TYPE ... ADD VALUE is non-transactional in older PostgreSQL but
  // supported since 9.6. BEFORE 'pending' so the natural order matches the
  // state transition.
  await knex.raw(`ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'payment_pending' BEFORE 'pending'`);
}

export async function down(_knex: Knex): Promise<void> {
  // PostgreSQL doesn't support removing values from an enum. No-op.
}
