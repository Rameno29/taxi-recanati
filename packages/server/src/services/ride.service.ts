import db from "../db";
import { AppError } from "../middleware/errorHandler";
import {
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  type RideCreateInput,
  type RideStatusUpdate,
} from "../types/rides";
import type { RideStatus } from "../types/db";
import {
  getActivePricingRule,
  calculateFare,
  buildPricingSnapshot,
  checkFixedRoute,
} from "./pricing.service";
import { runAutoDispatch } from "./dispatch.service";
import { broadcastRideStatus } from "../handlers/ride.handler";
import { capturePayment } from "./payment.service";

// Approximate distance using Haversine formula (for estimates without Google Maps API)
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): { distanceMeters: number; durationSeconds: number } {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = R * c;
  // Rough estimate: 40 km/h average speed in urban area
  const durationSeconds = (distanceMeters / 1000 / 40) * 3600;
  return { distanceMeters, durationSeconds };
}

/**
 * Create a new ride request.
 */
export async function createRide(customerId: string, input: RideCreateInput) {
  const pricingRule = await getActivePricingRule();
  const snapshot = buildPricingSnapshot(pricingRule);

  // Calculate estimated fare
  const { distanceMeters, durationSeconds } = haversineDistance(
    input.pickup_lat, input.pickup_lng,
    input.destination_lat, input.destination_lng
  );

  // Check for fixed route
  const fixedRoute = await checkFixedRoute(
    input.pickup_lat, input.pickup_lng,
    input.destination_lat, input.destination_lng
  );

  let fareBreakdown = calculateFare(
    distanceMeters, durationSeconds, input.vehicle_type, pricingRule
  );

  if (fixedRoute) {
    fareBreakdown = {
      ...fareBreakdown,
      is_fixed_route: true,
      fixed_route_min: Number(fixedRoute.min_price),
      fixed_route_max: Number(fixedRoute.max_price),
      estimated_fare: Number(fixedRoute.min_price),
    };
  }

  // Add reservation fee if applicable
  let estimatedFare = fareBreakdown.estimated_fare;
  if (input.type === "reservation") {
    estimatedFare += Number(pricingRule.reservation_fee);
  }

  const [ride] = await db("rides")
    .insert({
      customer_id: customerId,
      pickup_lat: input.pickup_lat,
      pickup_lng: input.pickup_lng,
      pickup_address: input.pickup_address || "",
      destination_lat: input.destination_lat,
      destination_lng: input.destination_lng,
      destination_address: input.destination_address || "",
      type: input.type,
      scheduled_at: input.scheduled_at || null,
      vehicle_type: input.vehicle_type,
      status: "pending",
      dispatch_mode: "auto",
      fare_estimate: estimatedFare,
      distance_meters: Math.round(distanceMeters),
      duration_seconds: Math.round(durationSeconds),
      pricing_snapshot_json: JSON.stringify(snapshot),
      requested_at: new Date(),
    })
    .returning("*");

  // Record initial status
  await db("ride_status_history").insert({
    ride_id: ride.id,
    old_status: null,
    new_status: "pending",
    changed_by_user_id: customerId,
    changed_by_system: false,
  });

  // Broadcast new ride to admin dashboard (real-time)
  broadcastRideStatus(ride.id, null, "pending", ride);

  // Auto-dispatch for immediate rides
  let dispatchResult = null;
  if (input.type === "immediate") {
    dispatchResult = await runAutoDispatch(ride.id);
  }

  return { ride, fareBreakdown, dispatchResult };
}

/**
 * Update ride status with full state machine validation and row-level locking.
 */
export async function updateRideStatus(
  rideId: string,
  update: RideStatusUpdate,
  userId: string,
  userRole: string
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

    const currentStatus = ride.status as RideStatus;
    const newStatus = update.status;

    // Validate transition
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new AppError(400, `Invalid transition: ${currentStatus} → ${newStatus}`);
    }

    // Build update payload
    const updatePayload: Record<string, any> = { status: newStatus };
    const now = new Date();

    switch (newStatus) {
      case "accepted":
        // Find driver_id from the user's driver record
        const driver = await trx("drivers").where("user_id", userId).first();
        if (!driver && userRole !== "admin") {
          throw new AppError(400, "No driver profile found for this user");
        }
        if (driver) {
          updatePayload.driver_id = driver.id;
          // Update driver status to busy
          await trx("drivers").where("id", driver.id).update({ status: "busy" });
        }
        updatePayload.accepted_at = now;
        break;
      case "arriving":
        updatePayload.arriving_at = now;
        break;
      case "in_progress":
        updatePayload.started_at = now;
        break;
      case "completed":
        updatePayload.completed_at = now;
        // Set final fare (same as estimate for now; actual metering in future)
        updatePayload.fare_final = ride.fare_estimate;
        // Release driver
        if (ride.driver_id) {
          await trx("drivers").where("id", ride.driver_id).update({ status: "available" });
        }
        break;
      case "cancelled":
        updatePayload.cancelled_at = now;
        updatePayload.cancelled_by = userId;
        updatePayload.cancellation_reason = update.cancellation_reason;
        // Release driver if assigned
        if (ride.driver_id) {
          await trx("drivers").where("id", ride.driver_id).update({ status: "available" });
        }
        break;
      case "no_show":
        updatePayload.cancelled_at = now;
        updatePayload.cancelled_by = userId;
        updatePayload.cancellation_reason = "Customer no-show";
        // Release driver
        if (ride.driver_id) {
          await trx("drivers").where("id", ride.driver_id).update({ status: "available" });
        }
        break;
    }

    // Update ride
    const [updatedRide] = await trx("rides")
      .where("id", rideId)
      .update(updatePayload)
      .returning("*");

    // Record status history
    await trx("ride_status_history").insert({
      ride_id: rideId,
      old_status: currentStatus,
      new_status: newStatus,
      changed_by_user_id: userId,
      changed_by_system: false,
    });

    // Broadcast status change via Socket.io
    broadcastRideStatus(rideId, currentStatus, newStatus, updatedRide);

    // Auto-capture payment on ride completion (best-effort)
    if (newStatus === "completed") {
      try {
        await capturePayment(rideId);
      } catch {
        // Payment capture failed — can be retried manually
      }
    }

    return updatedRide;
  });
}

/**
 * Get ride by ID with driver and customer info.
 */
export async function getRideById(rideId: string) {
  const ride = await db("rides as r")
    .leftJoin("users as customer", "r.customer_id", "customer.id")
    .leftJoin("drivers as d", "r.driver_id", "d.id")
    .leftJoin("users as driver_user", "d.user_id", "driver_user.id")
    .where("r.id", rideId)
    .select(
      "r.*",
      "customer.name as customer_name",
      "customer.phone as customer_phone",
      "driver_user.name as driver_name",
      "driver_user.phone as driver_phone",
      "d.license_plate",
      "d.vehicle_type as driver_vehicle_type"
    )
    .first();

  return ride || null;
}

/**
 * Get the user's current active (non-terminal) ride.
 */
export async function getActiveRide(userId: string) {
  // Check as customer
  let ride = await db("rides")
    .where("customer_id", userId)
    .whereNotIn("status", TERMINAL_STATUSES)
    .orderBy("created_at", "desc")
    .first();

  if (ride) return ride;

  // Check as driver
  const driver = await db("drivers").where("user_id", userId).first();
  if (driver) {
    ride = await db("rides")
      .where("driver_id", driver.id)
      .whereNotIn("status", TERMINAL_STATUSES)
      .orderBy("created_at", "desc")
      .first();
  }

  return ride || null;
}

/**
 * Get paginated ride history for a user.
 */
export async function getRideHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const offset = (page - 1) * limit;

  // Find driver record if exists
  const driver = await db("drivers").where("user_id", userId).first();

  const query = db("rides")
    .where(function () {
      this.where("customer_id", userId);
      if (driver) {
        this.orWhere("driver_id", driver.id);
      }
    })
    .whereIn("status", TERMINAL_STATUSES);

  const [{ count }] = await query.clone().count("* as count");

  const rides = await query
    .clone()
    .orderBy("created_at", "desc")
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
 * Rate a completed ride.
 */
export async function rateRide(
  rideId: string,
  userId: string,
  rating: number,
  comment?: string
) {
  const ride = await db("rides").where("id", rideId).first();

  if (!ride) {
    throw new AppError(404, "Ride not found");
  }

  if (ride.status !== "completed") {
    throw new AppError(400, "Can only rate completed rides");
  }

  if (ride.customer_id !== userId) {
    throw new AppError(403, "Only the customer can rate this ride");
  }

  if (ride.customer_rating !== null) {
    throw new AppError(409, "Ride has already been rated");
  }

  const [updatedRide] = await db("rides")
    .where("id", rideId)
    .update({
      customer_rating: rating,
      customer_feedback_text: comment || null,
      rated_at: new Date(),
    })
    .returning("*");

  return updatedRide;
}
