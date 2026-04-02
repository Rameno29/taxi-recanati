import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE driver_status AS ENUM ('offline', 'available', 'busy', 'paused', 'suspended');
    CREATE TYPE vehicle_type AS ENUM ('standard', 'monovolume');
  `);

  await knex.schema.createTable("drivers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("user_id").notNullable().unique().references("id").inTable("users").onDelete("CASCADE");
    table.string("license_plate").notNullable();
    table.specificType("vehicle_type", "vehicle_type").notNullable().defaultTo("standard");
    table.string("vehicle_model");
    table.string("vehicle_color");
    table.integer("max_capacity").notNullable().defaultTo(4);
    table.specificType("status", "driver_status").notNullable().defaultTo("offline");
    table.boolean("is_verified").notNullable().defaultTo(false);
    table.uuid("service_zone").references("id").inTable("zones").onDelete("SET NULL");
    table.decimal("current_lat", 10, 7);
    table.decimal("current_lng", 10, 7);
    table.timestamp("last_location_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("drivers");
  await knex.raw("DROP TYPE IF EXISTS vehicle_type");
  await knex.raw("DROP TYPE IF EXISTS driver_status");
}
