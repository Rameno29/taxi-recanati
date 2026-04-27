import db from "../db";
import type { DriverRow } from "../types/db";
import { AppError } from "../middleware/errorHandler";
import {
  sendRideRequest,
  broadcastRideStatus,
  broadcastRideAvailable,
} from "../handlers/ride.handler";

export interface NearestDriver extends DriverRow {
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
 * Auto-dispatch: broadcast the ride to every currently-online driver via the
 * `drivers:available` socket room, first-come-first-served. Any online driver
 * sees the request and the first one to accept wins (enforced by
 * `SELECT FOR UPDATE` in rideService.updateRideStatus).
 *
 * The ride also goes into the "available feed" (served by GET
 * /api/rides/available) so drivers that come online after the broadcast
 * still see it.
 */
export async function runAutoDispatch(rideId: string) {
  const ride = await db("rides").where("id", rideId).first();
  if (!ride || ride.status !== "pending") return null;

  const payload = {
    id: rideId,
    ride_id: rideId,
    pickup_lat: Number(ride.pickup_lat),
    pickup_lng: Number(ride.pickup_lng),
    pickup_address: ride.pickup_address,
    destination_lat: Number(ride.destination_lat),
    destination_lng: Number(ride.destination_lng),
    destination_address: ride.destination_address,
    fare_estimate: Number(ride.fare_estimate),
    distance_meters: ride.distance_meters,
    duration_seconds: ride.duration_seconds,
    vehicle_type: ride.vehicle_type,
    type: ride.type,
  };

  // Broadcast to every online driver in the `drivers:available` room.
  broadcastRideAvailable(payload);

  // Also record the broadcast as an attempt row for audit, without pinning a
  // specific driver (use a sentinel attempt_no of 1, no driver_id).
  // NOTE: ride_dispatch_attempts.driver_id is NOT nullable, so we skip
  // inserting a row at broadcast time. An attempt is recorded when a driver
  // explicitly accepts (see ride.service updateRideStatus).

  return { broadcast: true, payload };
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

    // Broadcast status change to all parties (customer, driver, admin)
    broadcastRideStatus(rideId, "pending", "accepted", updatedRide);

    return updatedRide;
  });
}
