import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import type { Knex } from "knex";
import type { UserRole, UserLanguage } from "../src/types/db";

export async function createTestUser(
  db: Knex,
  overrides: {
    role?: UserRole;
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    language?: UserLanguage;
  } = {}
) {
  const id = uuidv4();
  const passwordHash = overrides.password
    ? await bcrypt.hash(overrides.password, 10)
    : null;

  const user = {
    id,
    role: overrides.role || "customer",
    name: overrides.name || "Test User",
    email: overrides.email || `test-${id.slice(0, 8)}@example.com`,
    phone: overrides.phone || `+39${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    password_hash: passwordHash,
    language: overrides.language || "it",
  };

  await db("users").insert(user);
  return { ...user, password: overrides.password };
}

export async function createTestDriver(
  db: Knex,
  userId: string,
  overrides: {
    licensePlate?: string;
    vehicleType?: "standard" | "monovolume";
    status?: string;
    isVerified?: boolean;
    currentLat?: number;
    currentLng?: number;
  } = {}
) {
  const id = uuidv4();
  const driver = {
    id,
    user_id: userId,
    license_plate: overrides.licensePlate || "XX000XX",
    vehicle_type: overrides.vehicleType || "standard",
    max_capacity: 4,
    status: overrides.status || "available",
    is_verified: overrides.isVerified !== undefined ? overrides.isVerified : true,
    current_lat: overrides.currentLat || 43.4034,
    current_lng: overrides.currentLng || 13.5498,
    last_location_at: new Date(),
  };

  await db("drivers").insert(driver);
  return driver;
}

export async function createTestPricingRule(
  db: Knex,
  overrides: {
    baseFare?: number;
    perKm?: number;
    perMinute?: number;
    nightSurchargePct?: number;
    minimumFare?: number;
  } = {}
) {
  const id = uuidv4();
  const rule = {
    id,
    base_fare: overrides.baseFare || 5.0,
    per_km: overrides.perKm || 1.2,
    per_minute: overrides.perMinute || 0.3,
    night_surcharge_pct: overrides.nightSurchargePct || 20.0,
    minimum_fare: overrides.minimumFare || 8.0,
    cancellation_fee: 5.0,
    reservation_fee: 3.0,
    vehicle_type_multiplier: JSON.stringify({ standard: 1.0, monovolume: 1.3 }),
  };

  await db("pricing_rules").insert(rule);
  return rule;
}

export async function createPushToken(
  db: Knex,
  userId: string,
  token?: string
) {
  const id = uuidv4();
  const record = {
    id,
    user_id: userId,
    token: token || `ExponentPushToken[${uuidv4().slice(0, 20)}]`,
    platform: "android",
  };
  await db("push_tokens").insert(record);
  return record;
}

export function cleanTables(db: Knex) {
  return async () => {
    await db.raw("TRUNCATE admin_actions, push_tokens, payments, messages, driver_locations, ride_dispatch_attempts, ride_status_history, rides, fixed_routes, pricing_rules, drivers, zones, users CASCADE");
  };
}
