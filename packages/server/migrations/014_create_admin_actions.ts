import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("admin_actions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("admin_user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("action_type").notNullable();
    table.string("entity_type").notNullable();
    table.uuid("entity_id");
    table.jsonb("payload_json");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_admin_actions_admin ON admin_actions (admin_user_id, created_at DESC)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("admin_actions");
}
