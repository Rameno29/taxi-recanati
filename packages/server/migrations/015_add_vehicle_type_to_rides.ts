import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("rides", (table) => {
    table.specificType("vehicle_type", "vehicle_type").defaultTo("standard");
    table.text("notes");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("rides", (table) => {
    table.dropColumn("vehicle_type");
    table.dropColumn("notes");
  });
}
