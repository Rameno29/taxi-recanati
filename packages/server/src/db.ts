import knex from "knex";
import { config } from "./config";

const db = knex({
  client: "pg",
  connection: config.databaseUrl,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: "../migrations",
    extension: "ts",
  },
});

export default db;
