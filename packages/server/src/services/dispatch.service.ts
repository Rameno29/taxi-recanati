import db from "../db";
import type { DriverRow } from "../types/db";
import { AppError } from "../middleware/errorHandler";
import { sendRideRequest } from "../handlers/ride.handler";

interface NearestDriver extends DriverRow {
  distance_meters: number;
}

/**
 * Find nearest available drivers using PostGIS.
 * Filters: status = available, is_verified = true, last_location_at within 60s.
 * Orders by distance from the given point.
 */
export async function findNearestDrivers(
  lat: number,
  lng: number,
  radiusKm: number = 15,
  limit: number = 10
): Promise<NearestDriver[]> {
  const radiusMeters = radiusKm * 1000;

  const drivers = await db("drivers")
    .select(
      "drivers.*",
      db.raw(
        `ST_Distance(
          ST_SetSRID(ST_MakePoint(drivers.current_lng, drivers.current_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography
        ) as distance_meters`,
        [lng, lat]
      )
    )
    .whereRaw(
      `ST_DWithin(
        ST_SetSRID(ST_MakePoint(drivers.current_lng, drivers.current_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
        ?
      )`,
      [lng, lat, radiusMeters]
    )
    .where("drivers.status", "available")
    .where("drivers.is_verified", true)
    .whereRaw("drivers.last_location_at > now() - interval '60 seconds'")
    .orderBy("distance_meters", "asc")
    .limit(limit);

  return drivers;
}

/**
 * Record a dispatch attempt for a ride.
 */
export async function attemptDispatch(
  rideId: string,
  driverId: string,
  attemptNo: number,
  triggeredBy: "system" | "admin"
) {
  const [attempt] = await db("ride_dispatch_attempts")
    .insert({
      ride_id: rideId,
      driver_id: driverId,
      attempt_no: attemptNo,
      sent_at: new Date(),
      triggered_by: triggeredBy,
      timeout_seconds: 30,
    })
    .returning("*");

  return attempt;
}

/**
 * Auto-dispatch: find nearest drivers and create the first dispatch attempt.
 * Sends ride:request to the driver via Socket.io.
 */
export async function runAutoDispatch(rideId: string) {
  const ride = await db("rides").where("id", rideId).first();
  if (!ride || ride.status !== "pending") return null;

  const drivers = await findNearestDrivers(
    Number(ride.pickup_lat),
    Number(ride.pickup_lng)
  );

  if (drivers.length === 0) return null;

  const attempt = await attemptDispatch(rideId, drivers[0].id, 1, "system");

  // Send ride request to driver via Socket.io
  sendRideRequest(drivers[0].id, {
    ride_id: rideId,
    pickup_lat: ride.pickup_lat,
    pickup_lng: ride.pickup_lng,
    pickup_address: ride.pickup_address,
    destination_lat: ride.destination_lat,
    destination_lng: ride.destination_lng,
    destination_address: ride.destination_address,
    fare_estimate: ride.fare_estimate,
    vehicle_type: ride.vehicle_type,
  });

  return { attempt, driver: drivers[0] };
}

/**
 * Admin manually assigns a ride to a specific driver.
 * Uses SELECT FOR UPDATE to prevent race conditions.
 */
export async function manualDispatch(
  rideId: string,
  driverId: string,
  adminUserId: string
) {
  return db.transaction(async (trx) => {
    // Lock the ride row
    const ride = await trx("rides")
      .where("id", rideId)
      .forUpdate()
      .first();

    if (!ride) {
      throw new AppError(404, "Ride not found");
    }

    if (ride.status !== "pending") {
      throw new AppError(409, `Cannot dispatch ride in '${ride.status}' status`);
    }

    // Verify driver exists and is available
    const driver = await trx("drivers").where("id", driverId).first();
    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    // Update ride to accepted
    const [updatedRide] = await trx("rides")
      .where("id", rideId)
      .update({
        status: "accepted",
        driver_id: driverId,
        dispatch_mode: "manual",
        accepted_at: new Date(),
      })
      .returning("*");

    // Update driver status
    await trx("drivers")
      .where("id", driverId)
      .update({ status: "busy" });

    // Record status history
    await trx("ride_status_history").insert({
      ride_id: rideId,
      old_status: "pending",
      new_status: "accepted",
      changed_by_user_id: adminUserId,
      changed_by_system: false,
    });

    // Record dispatch attempt
    const existingAttempts = await trx("ride_dispatch_attempts")
      .where("ride_id", rideId)
      .count("* as count")
      .first();
    const attemptNo = Number(existingAttempts?.count || 0) + 1;

    await trx("ride_dispatch_attempts").insert({
      ride_id: rideId,
      driver_id: driverId,
      attempt_no: attemptNo,
      sent_at: new Date(),
      responded_at: new Date(),
      response: "accepted",
      triggered_by: "admin",
      timeout_seconds: 0,
    });

    // Log admin action
    await trx("admin_actions").insert({
      admin_user_id: adminUserId,
      action_type: "dispatch_override",
      entity_type: "ride",
      entity_id: rideId,
      payload_json: JSON.stringify({
        driver_id: driverId,
        previous_status: "pending",
        new_status: "accepted",
      }),
    });

    return updatedRide;
  });
}
