import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE ride_type AS ENUM ('immediate', 'reservation', 'tour');
    CREATE TYPE ride_status AS ENUM ('pending', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled', 'expired', 'no_show');
    CREATE TYPE dispatch_mode AS ENUM ('auto', 'manual');
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed');
  `);

  await knex.schema.createTable("rides", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("customer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("driver_id").references("id").inTable("drivers").onDelete("SET NULL");
    table.specificType("type", "ride_type").notNullable();
    table.specificType("status", "ride_status").notNullable().defaultTo("pending");
    table.specificType("dispatch_mode", "dispatch_mode").notNullable().defaultTo("auto");
    table.decimal("pickup_lat", 10, 7).notNullable();
    table.decimal("pickup_lng", 10, 7).notNullable();
    table.decimal("destination_lat", 10, 7).notNullable();
    table.decimal("destination_lng", 10, 7).notNullable();
    table.string("pickup_address").notNullable();
    table.string("destination_address").notNullable();
    table.timestamp("scheduled_at", { useTz: true });
    table.integer("distance_meters");
    table.integer("duration_seconds");
    table.decimal("fare_estimate", 10, 2);
    table.decimal("fare_final", 10, 2);
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.jsonb("pricing_snapshot_json");
    table.specificType("payment_status", "payment_status").notNullable().defaultTo("pending");
    table.string("tour_category");
    table.smallint("customer_rating");
    table.text("customer_feedback_text");
    table.smallint("driver_rating");
    table.text("driver_feedback_text");
    table.timestamp("rated_at", { useTz: true });
    table.timestamp("requested_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("accepted_at", { useTz: true });
    table.timestamp("arriving_at", { useTz: true });
    table.timestamp("started_at", { useTz: true });
    table.timestamp("completed_at", { useTz: true });
    table.timestamp("cancelled_at", { useTz: true });
    table.uuid("cancelled_by").references("id").inTable("users").onDelete("SET NULL");
    table.text("cancellation_reason");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_rides_customer ON rides (customer_id)");
  await knex.raw("CREATE INDEX idx_rides_driver ON rides (driver_id)");
  await knex.raw("CREATE INDEX idx_rides_status ON rides (status)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("rides");
  await knex.raw("DROP TYPE IF EXISTS payment_status");
  await knex.raw("DROP TYPE IF EXISTS dispatch_mode");
  await knex.raw("DROP TYPE IF EXISTS ride_status");
  await knex.raw("DROP TYPE IF EXISTS ride_type");
}
