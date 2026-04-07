import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'premium'`);
  await knex.raw(`ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'van'`);
}

export async function down(knex: Knex): Promise<void> {
  // PostgreSQL does not support removing values from an enum.
  // To rollback, you would need to create a new enum, migrate data, and swap.
  // For safety, this is a no-op.
}
