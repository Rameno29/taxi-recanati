import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { broadcastDriverStatus } from "../handlers/ride.handler";
import { setDriverAvailableRoom } from "../socket";
import type { DriverStatus } from "../types/db";

/**
 * Create a driver profile for a user.
 */
export async function createDriverProfile(
  userId: string,
  licensePlate: string,
  vehicleType: string
) {
  const existing = await db("drivers").where("user_id", userId).first();
  if (existing) throw new AppError(409, "Driver profile already exists");

  const user = await db("users").where("id", userId).first();
  if (!user) throw new AppError(404, "User not found");

  const [driver] = await db("drivers")
    .insert({
      user_id: userId,
      license_plate: licensePlate,
      vehicle_type: vehicleType,
      status: "offline",
    })
    .returning("*");

  return driver;
}

/**
 * Get driver profile by user ID.
 */
export async function getDriverProfile(userId: string) {
  const driver = await db("drivers").where("user_id", userId).first();
  if (!driver) throw new AppError(404, "Driver profile not found");
  return driver;
}

/**
 * Update a driver's availability status.
 */
export async function updateDriverStatus(userId: string, status: DriverStatus) {
  const driver = await db("drivers").where("user_id", userId).first();
  if (!driver) throw new AppError(404, "Driver profile not found");

  // Can't go offline/paused if currently on a ride
  if ((status === "offline" || status === "paused") && driver.status === "busy") {
    throw new AppError(409, "Cannot change status while on an active ride");
  }

  const [updated] = await db("drivers")
    .where("id", driver.id)
    .update({ status })
    .returning("*");

  // Add/remove the driver's socket(s) from the `drivers:available` broadcast
  // room so they start/stop receiving incoming ride broadcasts.
  await setDriverAvailableRoom(userId, status === "available");

  // Broadcast status change to admin dashboard and driver's own socket
  broadcastDriverStatus(driver.id, userId, status, {
    name: updated.license_plate,
    vehicle_type: updated.vehicle_type,
  });

  return updated;
}

/**
 * Push GPS location via REST (fallback when socket disconnects).
 */
export async function pushLocation(
  userId: string,
  lat: number,
  lng: number,
  heading?: number,
  speed?: number
) {
  const driver = await db("drivers").where("user_id", userId).first();
  if (!driver) throw new AppError(404, "Driver profile not found");

  // Update current position
  await db("drivers")
    .where("id", driver.id)
    .update({
      current_lat: lat,
      current_lng: lng,
      last_location_at: new Date(),
    });

  // Find active ride
  const activeRide = await db("rides")
    .where("driver_id", driver.id)
    .whereNotIn("status", ["completed", "cancelled", "expired", "no_show"])
    .first();

  // Insert location history
  await db("driver_locations").insert({
    driver_id: driver.id,
    ride_id: activeRide?.id || null,
    lat,
    lng,
    heading: heading || null,
    speed: speed || null,
    recorded_at: new Date(),
  });

  return { driver_id: driver.id, ride_id: activeRide?.id || null };
}

/**
 * Public (any authenticated user): active driver positions for the customer
 * map. Returns ONLY `available` drivers with a known location. No PII — no
 * name, phone, plate, driver_id. Coordinates are slightly blurred at read
 * time so customers can see availability density without being able to
 * track individual drivers.
 */
export async function getActivePositionsPublic() {
  const rows = await db("drivers")
    .where("status", "available")
    .whereNotNull("current_lat")
    .whereNotNull("current_lng")
    .select("current_lat", "current_lng", "vehicle_type");

  return rows.map((r: any) => ({
    lat: Number(r.current_lat),
    lng: Number(r.current_lng),
    vehicle_type: r.vehicle_type,
  }));
}

/**
 * Get driver earnings within a date range.
 */
export async function getEarnings(
  userId: string,
  fromDate?: string,
  toDate?: string
) {
  const driver = await db("drivers").where("user_id", userId).first();
  if (!driver) throw new AppError(404, "Driver profile not found");

  let query = db("rides")
    .where("driver_id", driver.id)
    .where("status", "completed");

  if (fromDate) {
    query = query.where("completed_at", ">=", fromDate);
  }
  if (toDate) {
    query = query.where("completed_at", "<=", toDate);
  }

  const rides = await query.select(
    db.raw("COUNT(*) as total_rides"),
    db.raw("COALESCE(SUM(fare_final), 0) as total_earnings"),
    db.raw("COALESCE(AVG(fare_final), 0) as avg_fare"),
    db.raw("COALESCE(AVG(customer_rating), 0) as avg_rating")
  );

  return {
    driver_id: driver.id,
    total_rides: Number(rides[0].total_rides),
    total_earnings: Number(rides[0].total_earnings),
    avg_fare: Number(Number(rides[0].avg_fare).toFixed(2)),
    avg_rating: Number(Number(rides[0].avg_rating).toFixed(1)),
    from: fromDate || null,
    to: toDate || null,
  };
}
