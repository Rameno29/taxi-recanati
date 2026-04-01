import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("zones", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("name").notNullable();
    table.string("city").notNullable();
    table.specificType("polygon", "geometry(Polygon, 4326)");
    table.boolean("active").notNullable().defaultTo(true);
  });

  await knex.raw("CREATE INDEX idx_zones_polygon ON zones USING GIST (polygon)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("zones");
}
