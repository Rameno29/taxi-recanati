import db from "../db";
import { AppError } from "../middleware/errorHandler";

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
    .orderBy("d.created_at", "desc");

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

  return updated;
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
