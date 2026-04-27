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
import { broadcastRideStatus, broadcastDriverStatus, broadcastRideUnavailable } from "../handlers/ride.handler";
import { capturePayment, cancelAuthorizedPayment } from "./payment.service";

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

  // Rides start in "payment_pending" — dispatch is blocked until the
  // customer's PaymentIntent reaches `requires_capture` and the client
  // calls POST /api/rides/:id/activate. This prevents drivers from seeing
  // (or accepting) rides that haven't been paid for yet.
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
      status: "payment_pending",
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
    new_status: "payment_pending",
    changed_by_user_id: customerId,
    changed_by_system: false,
  });

  // Broadcast to admin dashboard (so they can see pending-payment rides too)
  broadcastRideStatus(ride.id, null, "payment_pending", ride);

  // Dispatch happens later, from activateRide(), after payment authorization.
  return { ride, fareBreakdown, dispatchResult: null };
}

/**
 * Transition a ride from "payment_pending" to "pending" after the customer's
 * PaymentIntent has been authorized. Runs auto-dispatch for immediate rides.
 *
 * Called by the client after the Stripe Payment Sheet confirms, or defensively
 * by the `payment_intent.amount_capturable_updated` / `payment_intent.succeeded`
 * webhook.
 */
export async function activateRide(rideId: string, customerId: string) {
  // Perform the state transition in a transaction, then run dispatch OUTSIDE
  // so that runAutoDispatch's fresh DB reads see the committed "pending" row.
  const updated = await db.transaction(async (trx) => {
    const ride = await trx("rides").where("id", rideId).forUpdate().first();
    if (!ride) throw new AppError(404, "Ride not found");
    if (ride.customer_id !== customerId) {
      throw new AppError(403, "Not authorized to activate this ride");
    }

    // Idempotent — if already activated, return as-is
    if (ride.status === "pending" || ride.status === "accepted") {
      return ride;
    }
    if (ride.status !== "payment_pending") {
      throw new AppError(
        409,
        `Cannot activate ride in '${ride.status}' status`
      );
    }

    // Verify the ride has an authorized payment
    const payment = await trx("payments")
      .where("ride_id", rideId)
      .whereIn("status", ["authorized", "captured"])
      .first();
    if (!payment) {
      throw new AppError(
        402,
        "Il pagamento non è stato completato. Riprova."
      );
    }

    const [row] = await trx("rides")
      .where("id", rideId)
      .update({ status: "pending" })
      .returning("*");

    await trx("ride_status_history").insert({
      ride_id: rideId,
      old_status: "payment_pending",
      new_status: "pending",
      changed_by_user_id: customerId,
      changed_by_system: false,
    });

    return row;
  });

  // Only dispatch if we actually transitioned (not an idempotent re-call)
  let dispatchResult = null;
  if (updated.status === "pending") {
    broadcastRideStatus(rideId, "payment_pending", "pending", updated);
    if (updated.type === "immediate") {
      dispatchResult = await runAutoDispatch(rideId);
    }
  }

  return { ride: updated, dispatchResult };
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
          broadcastDriverStatus(driver.id, userId, "busy");
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
          const drvCompleted = await trx("drivers").where("id", ride.driver_id).select("user_id").first();
          if (drvCompleted) broadcastDriverStatus(ride.driver_id, drvCompleted.user_id, "available");
        }
        break;
      case "cancelled":
        updatePayload.cancelled_at = now;
        updatePayload.cancelled_by = userId;
        updatePayload.cancellation_reason = update.cancellation_reason;
        // Release driver if assigned
        if (ride.driver_id) {
          await trx("drivers").where("id", ride.driver_id).update({ status: "available" });
          const drvCancelled = await trx("drivers").where("id", ride.driver_id).select("user_id").first();
          if (drvCancelled) broadcastDriverStatus(ride.driver_id, drvCancelled.user_id, "available");
        }
        break;
      case "no_show":
        updatePayload.cancelled_at = now;
        updatePayload.cancelled_by = userId;
        updatePayload.cancellation_reason = "Customer no-show";
        // Release driver
        if (ride.driver_id) {
          await trx("drivers").where("id", ride.driver_id).update({ status: "available" });
          const drvNoShow = await trx("drivers").where("id", ride.driver_id).select("user_id").first();
          if (drvNoShow) broadcastDriverStatus(ride.driver_id, drvNoShow.user_id, "available");
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

    // If the ride is no longer available for pickup (accepted by another
    // driver, or cancelled/expired while still pending), tell every online
    // driver in `drivers:available` to drop it from their local list.
    if (
      currentStatus === "pending" &&
      (newStatus === "accepted" ||
        newStatus === "cancelled" ||
        newStatus === "expired")
    ) {
      broadcastRideUnavailable(rideId, newStatus);
    }

    // Auto-capture payment on ride completion (best-effort)
    if (newStatus === "completed") {
      try {
        await capturePayment(rideId);
      } catch {
        // Payment capture failed — can be retried manually
      }
    }

    // On cancellation/expiry/no-show, release the pre-authorized hold on the
    // customer's payment method. If the payment was already captured (e.g.
    // a completed ride that was later marked as cancelled administratively)
    // we leave it alone — use a refund for that case.
    if (
      newStatus === "cancelled" ||
      newStatus === "expired" ||
      newStatus === "no_show"
    ) {
      try {
        await cancelAuthorizedPayment(rideId);
      } catch {
        // Payment cancel failed — log and continue; admin can handle via
        // dashboard.
      }
    }

    return updatedRide;
  });
}

/**
 * List rides currently available for a driver to accept — all rides in
 * `pending` state with no driver yet. Used by:
 *   - driver-app when toggling online (initial load)
 *   - driver-app as fallback if socket reconnects and missed broadcasts
 *
 * Only returns rides that are immediate pickups (not scheduled reservations
 * for future times that drivers can't accept yet).
 */
export async function getAvailableRides() {
  const rows = await db("rides")
    .where("status", "pending")
    .whereNull("driver_id")
    .orderBy("requested_at", "asc")
    .select(
      "id",
      "pickup_lat",
      "pickup_lng",
      "pickup_address",
      "destination_lat",
      "destination_lng",
      "destination_address",
      "fare_estimate",
      "distance_meters",
      "duration_seconds",
      "vehicle_type",
      "type",
      "requested_at"
    );

  return rows.map((r: any) => ({
    id: r.id,
    ride_id: r.id,
    pickup_lat: Number(r.pickup_lat),
    pickup_lng: Number(r.pickup_lng),
    pickup_address: r.pickup_address,
    destination_lat: Number(r.destination_lat),
    destination_lng: Number(r.destination_lng),
    destination_address: r.destination_address,
    fare_estimate: Number(r.fare_estimate),
    distance_meters: r.distance_meters,
    duration_seconds: r.duration_seconds,
    vehicle_type: r.vehicle_type,
    type: r.type,
    requested_at: r.requested_at,
  }));
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
      "d.vehicle_type as driver_vehicle_type",
      "d.user_id as driver_user_id"
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

  // Broadcast rating to admin and driver
  broadcastRideStatus(rideId, "completed" as any, "completed" as any, updatedRide);

  return updatedRide;
}
