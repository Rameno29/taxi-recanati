import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE message_type AS ENUM ('text', 'system')");

  await knex.schema.createTable("messages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.uuid("sender_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.specificType("message_type", "message_type").notNullable().defaultTo("text");
    table.text("body").notNullable();
    table.timestamp("read_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_messages_ride ON messages (ride_id, created_at)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("messages");
  await knex.raw("DROP TYPE IF EXISTS message_type");
}
