import { Knex } from "knex";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export async function seed(knex: Knex): Promise<void> {
  await knex.raw("TRUNCATE admin_actions, push_tokens, payments, messages, driver_locations, ride_dispatch_attempts, ride_status_history, rides, fixed_routes, pricing_rules, drivers, zones, users CASCADE");

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000);

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

  // ── Driver user 2 (Luca) ──
  const driverUserId2 = uuidv4();
  await knex("users").insert({
    id: driverUserId2,
    role: "driver",
    name: "Luca Neri",
    email: "luca@taxirecanati.it",
    phone: "+393339876543",
    password_hash: await bcrypt.hash("driver123", 10),
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

  // ── Customer user 2 ──
  const customerUserId2 = uuidv4();
  await knex("users").insert({
    id: customerUserId2,
    role: "customer",
    name: "Giovanni Verdi",
    email: "giovanni@example.com",
    phone: "+393282222222",
    password_hash: await bcrypt.hash("customer123", 10),
    language: "it",
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

  const driverId2 = uuidv4();
  await knex("drivers").insert({
    id: driverId2,
    user_id: driverUserId2,
    license_plate: "MC456CD",
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

  // Admin is also a driver
  const adminDriverId = uuidv4();
  await knex("drivers").insert({
    id: adminDriverId,
    user_id: adminId,
    license_plate: "MC987ZZ",
    vehicle_type: "standard",
    vehicle_model: "Fiat Tipo",
    vehicle_color: "Grey",
    max_capacity: 4,
    status: "offline",
    is_verified: true,
    service_zone: recanatiZoneId,
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

  // ── Sample rides (last 7 days) ─────────────────────────
  const rideIds: string[] = [];

  // 8 completed rides spread across last 7 days
  const completedRidesData = [
    { cust: customerUserId, drv: driverId, ago: 6, dist: 2500, dur: 480, est: 9, final: 9.50, rating: 5, pickup: "Piazza Leopardi, Recanati", dest: "Via Roma 15, Recanati" },
    { cust: customerUserId2, drv: driverId, ago: 5, dist: 5800, dur: 720, est: 14, final: 14.90, rating: 4, pickup: "Via Calcagni, Recanati", dest: "Stazione FS Porto Recanati" },
    { cust: customerUserId, drv: driverId2, ago: 4, dist: 32000, dur: 2400, est: 62, final: 65, rating: 5, pickup: "Piazza Leopardi, Recanati", dest: "Aeroporto Ancona-Falconara" },
    { cust: customerUserId2, drv: driverId2, ago: 3, dist: 3200, dur: 540, est: 10, final: 10.50, rating: 4, pickup: "Via Passeri 20, Recanati", dest: "Loreto Santuario" },
    { cust: customerUserId, drv: driverId, ago: 3, dist: 4100, dur: 600, est: 12, final: 11.80, rating: 5, pickup: "Via Leopardi 8, Recanati", dest: "Porto Recanati Centro" },
    { cust: customerUserId2, drv: driverId, ago: 2, dist: 2800, dur: 500, est: 9.5, final: 9.80, rating: 4, pickup: "Via Roma 15, Recanati", dest: "Piazza Leopardi, Recanati" },
    { cust: customerUserId, drv: driverId2, ago: 1, dist: 6500, dur: 900, est: 16, final: 16.40, rating: 5, pickup: "Piazza Leopardi, Recanati", dest: "Montelupone Centro" },
    { cust: customerUserId2, drv: driverId, ago: 0.5, dist: 1800, dur: 360, est: 8, final: 8, rating: null, pickup: "Via Passeri 20, Recanati", dest: "Via Calcagni 10, Recanati" },
  ];

  for (const r of completedRidesData) {
    const id = uuidv4();
    rideIds.push(id);
    await knex("rides").insert({
      id,
      customer_id: r.cust,
      driver_id: r.drv,
      type: r.dist > 20000 ? "reservation" : "immediate",
      status: "completed",
      pickup_lat: 43.4036, pickup_lng: 13.5497,
      destination_lat: 43.4100, destination_lng: 13.5600,
      pickup_address: r.pickup,
      destination_address: r.dest,
      distance_meters: r.dist,
      duration_seconds: r.dur,
      fare_estimate: r.est,
      fare_final: r.final,
      payment_status: "captured",
      customer_rating: r.rating,
      customer_feedback_text: r.rating === 5 ? "Ottimo servizio!" : null,
      requested_at: daysAgo(r.ago),
      accepted_at: daysAgo(r.ago),
      started_at: daysAgo(r.ago),
      completed_at: daysAgo(r.ago),
      created_at: daysAgo(r.ago),
    });
  }

  // 1 cancelled ride
  const cancelledId = uuidv4();
  rideIds.push(cancelledId);
  await knex("rides").insert({
    id: cancelledId,
    customer_id: customerUserId,
    type: "immediate",
    status: "cancelled",
    pickup_lat: 43.4036, pickup_lng: 13.5497,
    destination_lat: 43.4200, destination_lng: 13.5800,
    pickup_address: "Piazza Leopardi, Recanati",
    destination_address: "Loreto Santuario",
    fare_estimate: 18.0,
    payment_status: "pending",
    cancelled_by: customerUserId,
    cancellation_reason: "Trovato passaggio",
    requested_at: daysAgo(4),
    cancelled_at: daysAgo(4),
    created_at: daysAgo(4),
  });

  // 1 pending ride (for dispatch testing in admin dashboard)
  await knex("rides").insert({
    customer_id: customerUserId2,
    type: "immediate",
    status: "pending",
    pickup_lat: 43.4060, pickup_lng: 13.5510,
    destination_lat: 43.4036, destination_lng: 13.5497,
    pickup_address: "Via Passeri 20, Recanati",
    destination_address: "Piazza Leopardi, Recanati",
    fare_estimate: 7.50,
    payment_status: "pending",
    created_at: hoursAgo(0.5),
  });

  // 1 in_progress ride
  await knex("rides").insert({
    customer_id: customerUserId,
    driver_id: driverId,
    type: "immediate",
    status: "in_progress",
    pickup_lat: 43.4036, pickup_lng: 13.5497,
    destination_lat: 43.4150, destination_lng: 13.5700,
    pickup_address: "Piazza Leopardi, Recanati",
    destination_address: "Porto Recanati Lungomare",
    distance_meters: 8500,
    fare_estimate: 18.50,
    payment_status: "authorized",
    requested_at: hoursAgo(0.2),
    accepted_at: hoursAgo(0.15),
    started_at: hoursAgo(0.1),
    created_at: hoursAgo(0.2),
  });

  // ── Audit log entries ──────────────────────────────────
  await knex("admin_actions").insert([
    {
      admin_user_id: adminId,
      action_type: "driver_update",
      entity_type: "driver",
      entity_id: driverId,
      payload_json: JSON.stringify({ field: "status", from: "offline", to: "available" }),
      created_at: daysAgo(5),
    },
    {
      admin_user_id: adminId,
      action_type: "manual_dispatch",
      entity_type: "ride",
      entity_id: rideIds[0],
      payload_json: JSON.stringify({ driver_id: driverId, reason: "Closest driver" }),
      created_at: daysAgo(4),
    },
    {
      admin_user_id: adminId,
      action_type: "driver_update",
      entity_type: "driver",
      entity_id: driverId2,
      payload_json: JSON.stringify({ field: "is_verified", from: false, to: true }),
      created_at: daysAgo(3),
    },
    {
      admin_user_id: adminId,
      action_type: "ride_cancel",
      entity_type: "ride",
      entity_id: cancelledId,
      payload_json: JSON.stringify({ reason: "Customer no-show after 15 min" }),
      created_at: daysAgo(2),
    },
  ]);

  console.log("");
  console.log("=== Dev seed complete ===");
  console.log("");
  console.log("  Admin:      david@taxirecanati.it / admin123");
  console.log("  Driver 1:   marco@taxirecanati.it / driver123");
  console.log("  Driver 2:   luca@taxirecanati.it  / driver123");
  console.log("  Customer 1: laura@example.com     / customer123");
  console.log("  Customer 2: giovanni@example.com  / customer123");
  console.log("");
  console.log(`  Rides: 8 completed, 1 cancelled, 1 pending, 1 in_progress`);
  console.log(`  Audit entries: 4`);
  console.log("");
}
