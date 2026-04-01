import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import type { Knex } from "knex";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const baseConfig: Knex.Config = {
  client: "pg",
  pool: { min: 2, max: 10 },
  migrations: {
    directory: "./migrations",
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
    connection: process.env.DATABASE_URL,
  },
  test: {
    ...baseConfig,
    connection: process.env.DATABASE_URL_TEST,
  },
  production: {
    ...baseConfig,
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 20 },
  },
};

export default config;
