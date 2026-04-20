import bcrypt from "bcrypt";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { broadcastDriverStatus } from "../handlers/ride.handler";
import { generateTempPassword } from "../utils/password";

const BCRYPT_ROUNDS = 10;

/**
 * List all drivers with their user info.
 */
export async function listDrivers(status?: string) {
  let query = db("drivers as d")
    .join("users as u", "d.user_id", "u.id")
    .select(
      "d.*",
      "u.name",
      "u.email",
      "u.phone"
    )
    .orderBy("u.created_at", "desc");

  if (status) {
    query = query.where("d.status", status);
  }

  return query;
}

/**
 * Admin: create a new driver (user + driver profile) with an auto-generated
 * temporary password. The plaintext password is returned ONCE — the admin
 * must copy it, it can never be retrieved afterwards (stored as bcrypt hash).
 */
export async function createDriver(input: {
  name: string;
  phone: string;
  email: string;
  license_plate: string;
  vehicle_type: "standard" | "monovolume" | "premium" | "van";
  vehicle_model?: string | null;
}) {
  // Enforce company email domain
  if (!input.email.toLowerCase().endsWith("@taxirecanati.it")) {
    throw new AppError(400, "Email must end with @taxirecanati.it");
  }

  // Uniqueness checks (before opening the transaction — cheaper failure path)
  const [phoneExists, emailExists] = await Promise.all([
    db("users").where("phone", input.phone).first(),
    db("users").where("email", input.email).first(),
  ]);
  if (phoneExists) throw new AppError(409, "A user with this phone already exists");
  if (emailExists) throw new AppError(409, "A user with this email already exists");

  const tempPassword = generateTempPassword(12);
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const { user, driver } = await db.transaction(async (trx) => {
    const [user] = await trx("users")
      .insert({
        name: input.name,
        phone: input.phone,
        email: input.email,
        password_hash: passwordHash,
        role: "driver",
        language: "it",
      })
      .returning("*");

    const [driver] = await trx("drivers")
      .insert({
        user_id: user.id,
        license_plate: input.license_plate,
        vehicle_type: input.vehicle_type,
        vehicle_model: input.vehicle_model || null,
        status: "offline",
      })
      .returning("*");

    return { user, driver };
  });

  return {
    driver: {
      ...driver,
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    tempPassword,
  };
}

/**
 * Admin: reset a driver's password. Generates a new random password,
 * stores its hash, and returns the plaintext ONCE.
 */
export async function resetDriverPassword(driverId: string) {
  const driver = await db("drivers").where("id", driverId).first();
  if (!driver) throw new AppError(404, "Driver not found");

  const tempPassword = generateTempPassword(12);
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  await db("users")
    .where("id", driver.user_id)
    .update({ password_hash: passwordHash });

  return { tempPassword };
}

/**
 * Admin: update a driver's user-level fields (name, phone) and/or
 * vehicle_model. Kept separate from adminUpdateDriver to avoid bloating
 * the mass-assignment-safe payload on PATCH /drivers/:id.
 */
export async function updateDriverDetails(
  driverId: string,
  updates: { name?: string; phone?: string; email?: string; vehicle_model?: string | null }
) {
  const driver = await db("drivers").where("id", driverId).first();
  if (!driver) throw new AppError(404, "Driver not found");

  // Enforce email domain if being changed
  if (updates.email && !updates.email.toLowerCase().endsWith("@taxirecanati.it")) {
    throw new AppError(400, "Email must end with @taxirecanati.it");
  }

  // Uniqueness: phone and email must remain unique (excluding this user)
  if (updates.phone) {
    const conflict = await db("users")
      .where("phone", updates.phone)
      .whereNot("id", driver.user_id)
      .first();
    if (conflict) throw new AppError(409, "Phone already in use");
  }
  if (updates.email) {
    const conflict = await db("users")
      .where("email", updates.email)
      .whereNot("id", driver.user_id)
      .first();
    if (conflict) throw new AppError(409, "Email already in use");
  }

  await db.transaction(async (trx) => {
    const userPayload: Record<string, any> = {};
    if (updates.name !== undefined) userPayload.name = updates.name;
    if (updates.phone !== undefined) userPayload.phone = updates.phone;
    if (updates.email !== undefined) userPayload.email = updates.email;
    if (Object.keys(userPayload).length > 0) {
      await trx("users").where("id", driver.user_id).update(userPayload);
    }

    if (updates.vehicle_model !== undefined) {
      await trx("drivers").where("id", driverId).update({
        vehicle_model: updates.vehicle_model,
      });
    }
  });

  const updated = await db("drivers as d")
    .join("users as u", "d.user_id", "u.id")
    .where("d.id", driverId)
    .select("d.*", "u.name", "u.email", "u.phone")
    .first();

  return updated;
}

/**
 * List rides with filters and pagination.
 */
export async function listRides(filters: {
  status?: string;
  driver_id?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  let query = db("rides as r")
    .leftJoin("users as customer", "r.customer_id", "customer.id")
    .leftJoin("drivers as d", "r.driver_id", "d.id")
    .leftJoin("users as driver_user", "d.user_id", "driver_user.id")
    .select(
      "r.*",
      "customer.name as customer_name",
      "customer.phone as customer_phone",
      "driver_user.name as driver_name",
      "driver_user.phone as driver_phone",
      "d.license_plate"
    );

  if (filters.status) {
    query = query.where("r.status", filters.status);
  }
  if (filters.driver_id) {
    query = query.where("r.driver_id", filters.driver_id);
  }

  const countQuery = query.clone();
  const [{ count }] = await countQuery.clearSelect().count("* as count");

  const rides = await query
    .orderBy("r.created_at", "desc")
    .limit(limit)
    .offset(offset);

  return {
    rides,
    total: Number(count),
    page,
    totalPages: Math.ceil(Number(count) / limit),
  };
}

/**
 * Get dashboard stats.
 */
export async function getDashboardStats() {
  const [rideStats] = await db("rides")
    .select(
      db.raw("COUNT(*) FILTER (WHERE status = 'pending') as pending_rides"),
      db.raw("COUNT(*) FILTER (WHERE status IN ('accepted', 'arriving', 'in_progress')) as active_rides"),
      db.raw("COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today"),
      db.raw("COALESCE(SUM(fare_final) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE), 0) as revenue_today")
    );

  const [driverStats] = await db("drivers")
    .select(
      db.raw("COUNT(*) as total_drivers"),
      db.raw("COUNT(*) FILTER (WHERE status = 'available') as online_drivers"),
      db.raw("COUNT(*) FILTER (WHERE status = 'busy') as busy_drivers")
    );

  return {
    rides: {
      pending: Number(rideStats.pending_rides),
      active: Number(rideStats.active_rides),
      completed_today: Number(rideStats.completed_today),
      revenue_today: Number(Number(rideStats.revenue_today).toFixed(2)),
    },
    drivers: {
      total: Number(driverStats.total_drivers),
      online: Number(driverStats.online_drivers),
      busy: Number(driverStats.busy_drivers),
    },
  };
}

/**
 * Admin: update a driver's status (e.g., suspend/reactivate).
 */
export async function adminUpdateDriver(
  driverId: string,
  updates: { status?: string; vehicle_type?: string; license_plate?: string }
) {
  const driver = await db("drivers").where("id", driverId).first();
  if (!driver) throw new AppError(404, "Driver not found");

  const payload: Record<string, any> = {};
  if (updates.status) payload.status = updates.status;
  if (updates.vehicle_type) payload.vehicle_type = updates.vehicle_type;
  if (updates.license_plate) payload.license_plate = updates.license_plate;

  if (Object.keys(payload).length === 0) {
    throw new AppError(400, "No updates provided");
  }

  const [updated] = await db("drivers")
    .where("id", driverId)
    .update(payload)
    .returning("*");

  // Broadcast driver status change to driver app + admin dashboard
  if (payload.status) {
    broadcastDriverStatus(driverId, driver.user_id, payload.status, {
      license_plate: updated.license_plate,
      vehicle_type: updated.vehicle_type,
    });
  }

  return updated;
}

/**
 * Revenue analytics with daily/weekly/monthly breakdown.
 */
export async function getRevenueAnalytics(period: "week" | "month" | "year" = "month") {
  const intervals: Record<string, string> = {
    week: "7 days",
    month: "30 days",
    year: "365 days",
  };

  const interval = intervals[period];

  // Daily revenue for the period
  const dailyRevenue = await db("rides")
    .where("status", "completed")
    .whereRaw("completed_at >= NOW() - ?::interval", [interval])
    .select(
      db.raw("DATE(completed_at) as date"),
      db.raw("COUNT(*) as rides"),
      db.raw("COALESCE(SUM(fare_final), 0) as revenue"),
      db.raw("COALESCE(AVG(fare_final), 0) as avg_fare")
    )
    .groupByRaw("DATE(completed_at)")
    .orderBy("date", "asc");

  // Totals for the period
  const [totals] = await db("rides")
    .where("status", "completed")
    .whereRaw("completed_at >= NOW() - ?::interval", [interval])
    .select(
      db.raw("COUNT(*) as total_rides"),
      db.raw("COALESCE(SUM(fare_final), 0) as total_revenue"),
      db.raw("COALESCE(AVG(fare_final), 0) as avg_fare"),
      db.raw("COALESCE(AVG(distance_meters), 0) as avg_distance"),
      db.raw("COALESCE(AVG(duration_seconds), 0) as avg_duration")
    );

  // Rides by status for the period
  const byStatus = await db("rides")
    .whereRaw("created_at >= NOW() - ?::interval", [interval])
    .select("status", db.raw("COUNT(*) as count"))
    .groupBy("status");

  // Rides by vehicle type
  const byVehicle = await db("rides")
    .where("status", "completed")
    .whereRaw("completed_at >= NOW() - ?::interval", [interval])
    .select("vehicle_type", db.raw("COUNT(*) as count"), db.raw("COALESCE(SUM(fare_final), 0) as revenue"))
    .groupBy("vehicle_type");

  // Peak hours
  const peakHours = await db("rides")
    .where("status", "completed")
    .whereRaw("completed_at >= NOW() - ?::interval", [interval])
    .select(
      db.raw("EXTRACT(HOUR FROM created_at)::int as hour"),
      db.raw("COUNT(*) as rides")
    )
    .groupByRaw("EXTRACT(HOUR FROM created_at)")
    .orderBy("rides", "desc")
    .limit(24);

  return {
    period,
    daily: dailyRevenue.map((d: any) => ({
      date: d.date,
      rides: Number(d.rides),
      revenue: Number(Number(d.revenue).toFixed(2)),
      avg_fare: Number(Number(d.avg_fare).toFixed(2)),
    })),
    totals: {
      rides: Number(totals.total_rides),
      revenue: Number(Number(totals.total_revenue).toFixed(2)),
      avg_fare: Number(Number(totals.avg_fare).toFixed(2)),
      avg_distance_km: Number((Number(totals.avg_distance) / 1000).toFixed(1)),
      avg_duration_min: Number((Number(totals.avg_duration) / 60).toFixed(1)),
    },
    by_status: byStatus.reduce((acc: Record<string, number>, s: any) => {
      acc[s.status] = Number(s.count);
      return acc;
    }, {}),
    by_vehicle: byVehicle.map((v: any) => ({
      vehicle_type: v.vehicle_type,
      count: Number(v.count),
      revenue: Number(Number(v.revenue).toFixed(2)),
    })),
    peak_hours: peakHours.map((h: any) => ({
      hour: h.hour,
      rides: Number(h.rides),
    })),
  };
}

/**
 * Driver performance rankings.
 */
export async function getDriverPerformance(period: "week" | "month" | "year" = "month") {
  const intervals: Record<string, string> = {
    week: "7 days",
    month: "30 days",
    year: "365 days",
  };
  const interval = intervals[period];

  const drivers = await db("rides as r")
    .join("drivers as d", "r.driver_id", "d.id")
    .join("users as u", "d.user_id", "u.id")
    .where("r.status", "completed")
    .whereRaw("r.completed_at >= NOW() - ?::interval", [interval])
    .select(
      "d.id as driver_id",
      "u.name",
      "d.license_plate",
      "d.vehicle_type",
      db.raw("COUNT(*) as total_rides"),
      db.raw("COALESCE(SUM(r.fare_final), 0) as total_revenue"),
      db.raw("COALESCE(AVG(r.fare_final), 0) as avg_fare"),
      db.raw("COALESCE(AVG(r.customer_rating), 0) as avg_rating"),
      db.raw("COUNT(r.customer_rating) as rated_rides")
    )
    .groupBy("d.id", "u.name", "d.license_plate", "d.vehicle_type")
    .orderBy("total_revenue", "desc");

  return drivers.map((d: any) => ({
    driver_id: d.driver_id,
    name: d.name,
    license_plate: d.license_plate,
    vehicle_type: d.vehicle_type,
    total_rides: Number(d.total_rides),
    total_revenue: Number(Number(d.total_revenue).toFixed(2)),
    avg_fare: Number(Number(d.avg_fare).toFixed(2)),
    avg_rating: Number(Number(d.avg_rating).toFixed(1)),
    rated_rides: Number(d.rated_rides),
  }));
}

/**
 * Get audit log (admin actions).
 */
export async function getAuditLog(filters: {
  page?: number;
  limit?: number;
  action_type?: string;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;

  let query = db("admin_actions as a")
    .leftJoin("users as u", "a.admin_user_id", "u.id")
    .select(
      "a.id",
      "a.admin_user_id",
      "a.action_type",
      "a.entity_type as target_type",
      "a.entity_id as target_id",
      "a.payload_json as details",
      "a.created_at",
      "u.name as admin_name",
      "u.email as admin_email"
    );

  if (filters.action_type) {
    query = query.where("a.action_type", filters.action_type);
  }

  const countQuery = query.clone();
  const [{ count }] = await countQuery.clearSelect().count("* as count");

  const actions = await query
    .orderBy("a.created_at", "desc")
    .limit(limit)
    .offset(offset);

  return {
    actions,
    total: Number(count),
    page,
    totalPages: Math.ceil(Number(count) / limit),
  };
}

/**
 * Get driver positions for the admin map.
 * By default returns only currently-active drivers (available/busy).
 * With `includeOffline=true`, also returns offline/suspended drivers that
 * have a last-known position, so admins can see where their fleet was last
 * seen.
 */
export async function getDriverPositions(includeOffline: boolean = false) {
  const statuses = includeOffline
    ? ["available", "busy", "offline", "suspended", "paused"]
    : ["available", "busy"];

  return db("drivers as d")
    .join("users as u", "d.user_id", "u.id")
    .whereIn("d.status", statuses)
    .whereNotNull("d.current_lat")
    .whereNotNull("d.current_lng")
    .select(
      "d.id",
      "d.status",
      "d.current_lat",
      "d.current_lng",
      "d.vehicle_type",
      "d.license_plate",
      "d.last_location_at",
      "u.name",
      "u.phone"
    );
}
