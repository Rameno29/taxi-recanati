import { Knex } from "knex";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export async function seed(knex: Knex): Promise<void> {
  await knex.raw("TRUNCATE admin_actions, push_tokens, payments, messages, driver_locations, ride_dispatch_attempts, ride_status_history, rides, fixed_routes, pricing_rules, drivers, zones, users CASCADE");

  // ── Admin user (David) ──
  const adminId = uuidv4();
  const adminPassword = await bcrypt.hash("admin123", 10);
  await knex("users").insert({
    id: adminId,
    role: "admin",
    name: "David Leonori",
    email: "david@taxirecanati.it",
    phone: "+393272047842",
    password_hash: adminPassword,
    language: "it",
  });

  // ── Driver user (Marco) ──
  const driverUserId = uuidv4();
  const driverPassword = await bcrypt.hash("driver123", 10);
  await knex("users").insert({
    id: driverUserId,
    role: "driver",
    name: "Marco Rossi",
    email: "marco@taxirecanati.it",
    phone: "+393331234567",
    password_hash: driverPassword,
    language: "it",
  });

  // ── Customer user ──
  const customerUserId = uuidv4();
  await knex("users").insert({
    id: customerUserId,
    role: "customer",
    name: "Laura Bianchi",
    email: "laura@example.com",
    phone: "+393281111111",
    password_hash: await bcrypt.hash("customer123", 10),
    language: "en",
  });

  // ── Zones ──
  const recanatiZoneId = uuidv4();
  const anconaAirportZoneId = uuidv4();
  const loretoStationZoneId = uuidv4();

  await knex("zones").insert([
    {
      id: recanatiZoneId,
      name: "Recanati Centro",
      city: "Recanati",
      polygon: knex.raw(
        "ST_GeomFromText('POLYGON((13.53 43.39, 13.57 43.39, 13.57 43.42, 13.53 43.42, 13.53 43.39))', 4326)"
      ),
      active: true,
    },
    {
      id: anconaAirportZoneId,
      name: "Ancona Falconara Airport",
      city: "Falconara Marittima",
      polygon: knex.raw(
        "ST_GeomFromText('POLYGON((13.35 43.60, 13.38 43.60, 13.38 43.63, 13.35 43.63, 13.35 43.60))', 4326)"
      ),
      active: true,
    },
    {
      id: loretoStationZoneId,
      name: "Loreto Station",
      city: "Loreto",
      polygon: knex.raw(
        "ST_GeomFromText('POLYGON((13.59 43.43, 13.62 43.43, 13.62 43.45, 13.59 43.45, 13.59 43.43))', 4326)"
      ),
      active: true,
    },
  ]);

  // ── Drivers ──
  const driverId = uuidv4();
  await knex("drivers").insert({
    id: driverId,
    user_id: driverUserId,
    license_plate: "FG123AB",
    vehicle_type: "standard",
    vehicle_model: "Fiat 500L",
    vehicle_color: "White",
    max_capacity: 4,
    status: "available",
    is_verified: true,
    service_zone: recanatiZoneId,
    current_lat: 43.4034,
    current_lng: 13.5498,
    last_location_at: new Date(),
  });

  const adminDriverId = uuidv4();
  await knex("drivers").insert({
    id: adminDriverId,
    user_id: adminId,
    license_plate: "MC987ZZ",
    vehicle_type: "monovolume",
    vehicle_model: "Mercedes Vito",
    vehicle_color: "Black",
    max_capacity: 7,
    status: "available",
    is_verified: true,
    service_zone: recanatiZoneId,
    current_lat: 43.405,
    current_lng: 13.551,
    last_location_at: new Date(),
  });

  // ── Fixed routes ──
  await knex("fixed_routes").insert([
    {
      name: "Recanati → Ancona Airport",
      origin_zone_id: recanatiZoneId,
      destination_zone_id: anconaAirportZoneId,
      min_price: 45.0,
      max_price: 55.0,
    },
    {
      name: "Recanati → Loreto Station",
      origin_zone_id: recanatiZoneId,
      destination_zone_id: loretoStationZoneId,
      min_price: 12.0,
      max_price: 18.0,
    },
  ]);

  // ── Pricing rules ──
  await knex("pricing_rules").insert({
    base_fare: 5.0,
    per_km: 1.2,
    per_minute: 0.3,
    night_surcharge_pct: 20.0,
    minimum_fare: 8.0,
    cancellation_fee: 5.0,
    reservation_fee: 3.0,
    vehicle_type_multiplier: JSON.stringify({ standard: 1.0, monovolume: 1.3 }),
    updated_by: adminId,
  });

  console.log("Dev seed complete: admin (david@taxirecanati.it / admin123), driver (marco@taxirecanati.it / driver123), customer (laura@example.com / customer123)");
}
