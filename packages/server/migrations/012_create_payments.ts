import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE pay_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed')");

  await knex.schema.createTable("payments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.string("provider").notNullable().defaultTo("stripe");
    table.string("stripe_payment_intent_id");
    table.decimal("amount", 10, 2).notNullable();
    table.decimal("captured_amount", 10, 2).notNullable().defaultTo(0);
    table.decimal("refunded_amount", 10, 2).notNullable().defaultTo(0);
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.string("payment_method_type");
    table.specificType("status", "pay_status").notNullable().defaultTo("pending");
    table.text("failure_reason");
    table.timestamp("paid_at", { useTz: true });
    table.string("webhook_event_id");
    table.jsonb("metadata_json");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_payments_ride ON payments (ride_id)");
  await knex.raw("CREATE UNIQUE INDEX idx_payments_webhook ON payments (webhook_event_id) WHERE webhook_event_id IS NOT NULL");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
  await knex.raw("DROP TYPE IF EXISTS pay_status");
}
