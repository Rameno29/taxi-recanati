import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { broadcastDriverStatus } from "../handlers/ride.handler";

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
    .whereRaw("completed_at >= NOW() - INTERVAL ?", [interval])
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
    .whereRaw("completed_at >= NOW() - INTERVAL ?", [interval])
    .select(
      db.raw("COUNT(*) as total_rides"),
      db.raw("COALESCE(SUM(fare_final), 0) as total_revenue"),
      db.raw("COALESCE(AVG(fare_final), 0) as avg_fare"),
      db.raw("COALESCE(AVG(distance_meters), 0) as avg_distance"),
      db.raw("COALESCE(AVG(duration_seconds), 0) as avg_duration")
    );

  // Rides by status for the period
  const byStatus = await db("rides")
    .whereRaw("created_at >= NOW() - INTERVAL ?", [interval])
    .select("status", db.raw("COUNT(*) as count"))
    .groupBy("status");

  // Rides by vehicle type
  const byVehicle = await db("rides")
    .where("status", "completed")
    .whereRaw("completed_at >= NOW() - INTERVAL ?", [interval])
    .select("vehicle_type", db.raw("COUNT(*) as count"), db.raw("COALESCE(SUM(fare_final), 0) as revenue"))
    .groupBy("vehicle_type");

  // Peak hours
  const peakHours = await db("rides")
    .where("status", "completed")
    .whereRaw("completed_at >= NOW() - INTERVAL ?", [interval])
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
    .whereRaw("r.completed_at >= NOW() - INTERVAL ?", [interval])
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
 * Get all active driver positions for the admin map.
 */
export async function getDriverPositions() {
  return db("drivers as d")
    .join("users as u", "d.user_id", "u.id")
    .whereIn("d.status", ["available", "busy"])
    .whereNotNull("d.current_lat")
    .select(
      "d.id",
      "d.status",
      "d.current_lat",
      "d.current_lng",
      "d.vehicle_type",
      "d.license_plate",
      "u.name",
      "u.phone"
    );
}
