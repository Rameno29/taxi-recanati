import type { Knex } from "knex";

/**
 * Adds Stripe Customer link on users and a payment_methods table that mirrors
 * the Stripe-side PaymentMethod objects for fast reads from our UI.
 *
 * - users.stripe_customer_id: lazy-created on first payment intent / setup intent
 * - payment_methods: one row per Stripe PaymentMethod the user saved. The Stripe
 *   PaymentMethod remains the source of truth; we detach on delete and rely on
 *   webhooks (payment_method.attached/detached) to stay in sync.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.string("stripe_customer_id").unique();
  });

  await knex.schema.createTable("payment_methods", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    // The actual Stripe identifier. Unique across our DB.
    table.string("stripe_payment_method_id").notNullable().unique();
    // "card" | "paypal" | "apple_pay" | "google_pay" | other
    table.string("type").notNullable();
    // For cards: "visa" | "mastercard" | "amex" | ...
    table.string("brand");
    table.string("last4", 4);
    table.smallint("exp_month");
    table.smallint("exp_year");
    // For wallet tokens we may still get card brand/last4 via card.wallet.type
    table.string("wallet_type"); // "apple_pay" | "google_pay" | null
    // For paypal we get the payer email
    table.string("paypal_email");
    // One default per user. Enforced at application level (set-default clears
    // all others in a transaction).
    table.boolean("is_default").notNullable().defaultTo(false);
    table
      .timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.raw(
    "CREATE INDEX idx_payment_methods_user ON payment_methods (user_id)"
  );
  await knex.raw(
    "CREATE UNIQUE INDEX idx_payment_methods_default ON payment_methods (user_id) WHERE is_default = true"
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payment_methods");
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("stripe_customer_id");
  });
}
