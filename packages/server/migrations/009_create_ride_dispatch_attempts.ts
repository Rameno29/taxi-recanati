import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE dispatch_response AS ENUM ('accepted', 'declined', 'timeout');
    CREATE TYPE dispatch_trigger AS ENUM ('system', 'admin');
  `);

  await knex.schema.createTable("ride_dispatch_attempts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.uuid("driver_id").notNullable().references("id").inTable("drivers").onDelete("CASCADE");
    table.integer("attempt_no").notNullable();
    table.timestamp("sent_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("responded_at", { useTz: true });
    table.specificType("response", "dispatch_response");
    table.specificType("triggered_by", "dispatch_trigger").notNullable().defaultTo("system");
    table.integer("timeout_seconds").notNullable().defaultTo(30);
  });

  await knex.raw("CREATE INDEX idx_dispatch_attempts_ride ON ride_dispatch_attempts (ride_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ride_dispatch_attempts");
  await knex.raw("DROP TYPE IF EXISTS dispatch_trigger");
  await knex.raw("DROP TYPE IF EXISTS dispatch_response");
}
