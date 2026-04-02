import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("fixed_routes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("name").notNullable();
    table.uuid("origin_zone_id").notNullable().references("id").inTable("zones").onDelete("CASCADE");
    table.uuid("destination_zone_id").notNullable().references("id").inTable("zones").onDelete("CASCADE");
    table.decimal("min_price", 10, 2).notNullable();
    table.decimal("max_price", 10, 2).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("fixed_routes");
}
