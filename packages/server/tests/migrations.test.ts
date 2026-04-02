import knex, { Knex } from "knex";
import knexConfig from "../knexfile";

let db: Knex;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  db = knex(knexConfig.test);
});

afterAll(async () => {
  await db.destroy();
});

describe("Database migrations", () => {
  test("all migrations run successfully", async () => {
    await db.migrate.rollback(undefined, true);

    const [batchNo, migrations] = await db.migrate.latest();
    expect(batchNo).toBe(1);
    expect(migrations.length).toBe(14);
  });

  test("all 14 tables exist after migration", async () => {
    const result = await db.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'knex_%'
      AND table_name != 'spatial_ref_sys'
      ORDER BY table_name
    `);

    const tableNames = result.rows.map((r: { table_name: string }) => r.table_name);
    expect(tableNames).toEqual([
      "admin_actions",
      "driver_locations",
      "drivers",
      "fixed_routes",
      "messages",
      "payments",
      "pricing_rules",
      "push_tokens",
      "ride_dispatch_attempts",
      "ride_status_history",
      "rides",
      "users",
      "zones",
    ]);
  });

  test("PostGIS extension is enabled", async () => {
    const result = await db.raw("SELECT PostGIS_Version()");
    expect(result.rows[0].postgis_version).toBeDefined();
  });

  test("uuid-ossp extension is enabled", async () => {
    const result = await db.raw("SELECT uuid_generate_v4()");
    expect(result.rows[0].uuid_generate_v4).toBeDefined();
  });

  test("all migrations roll back cleanly", async () => {
    await db.migrate.rollback(undefined, true);

    const result = await db.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'knex_%'
      AND table_name != 'spatial_ref_sys'
    `);

    expect(result.rows.length).toBe(0);

    // Re-run for other tests
    await db.migrate.latest();
  });
});
