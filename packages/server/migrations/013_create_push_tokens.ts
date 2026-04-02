import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE platform_type AS ENUM ('ios', 'android')");

  await knex.schema.createTable("push_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("token").notNullable().unique();
    table.specificType("platform", "platform_type").notNullable();
  });

  await knex.raw("CREATE INDEX idx_push_tokens_user ON push_tokens (user_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("push_tokens");
  await knex.raw("DROP TYPE IF EXISTS platform_type");
}
