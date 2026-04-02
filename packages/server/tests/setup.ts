import knex, { Knex } from "knex";
import knexConfig from "../knexfile";

let testDb: Knex;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  testDb = knex(knexConfig.test);
  await testDb.migrate.latest();
});

afterAll(async () => {
  await testDb.migrate.rollback(undefined, true);
  await testDb.destroy();
});

export { testDb };
