import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin');
    CREATE TYPE user_language AS ENUM ('it', 'en');
  `);

  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.specificType("role", "user_role").notNullable().defaultTo("customer");
    table.string("name").notNullable();
    table.string("email").unique();
    table.string("phone").unique().notNullable();
    table.string("password_hash");
    table.specificType("language", "user_language").notNullable().defaultTo("it");
    table.string("avatar");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("users");
  await knex.raw("DROP TYPE IF EXISTS user_language");
  await knex.raw("DROP TYPE IF EXISTS user_role");
}
