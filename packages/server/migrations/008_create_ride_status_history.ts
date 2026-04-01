import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("ride_status_history", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.specificType("old_status", "ride_status");
    table.specificType("new_status", "ride_status").notNullable();
    table.uuid("changed_by_user_id").references("id").inTable("users").onDelete("SET NULL");
    table.boolean("changed_by_system").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_ride_status_history_ride ON ride_status_history (ride_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ride_status_history");
}
