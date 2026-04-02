import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("pricing_rules", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.decimal("base_fare", 10, 2).notNullable();
    table.decimal("per_km", 10, 2).notNullable();
    table.decimal("per_minute", 10, 2).notNullable();
    table.decimal("night_surcharge_pct", 5, 2).notNullable().defaultTo(0);
    table.decimal("minimum_fare", 10, 2).notNullable();
    table.decimal("cancellation_fee", 10, 2).notNullable().defaultTo(0);
    table.decimal("reservation_fee", 10, 2).notNullable().defaultTo(0);
    table.jsonb("vehicle_type_multiplier").notNullable().defaultTo('{"standard": 1.0, "monovolume": 1.3}');
    table.specificType("time_window", "tstzrange");
    table.uuid("updated_by").references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("pricing_rules");
}
