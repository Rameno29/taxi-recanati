import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("driver_locations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("driver_id").notNullable().references("id").inTable("drivers").onDelete("CASCADE");
    table.uuid("ride_id").references("id").inTable("rides").onDelete("SET NULL");
    table.decimal("lat", 10, 7).notNullable();
    table.decimal("lng", 10, 7).notNullable();
    table.decimal("heading", 6, 2);
    table.decimal("speed", 6, 2);
    table.timestamp("recorded_at", { useTz: true }).notNullable();
  });

  await knex.raw("CREATE INDEX idx_driver_locations_driver_time ON driver_locations (driver_id, recorded_at DESC)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("driver_locations");
}
