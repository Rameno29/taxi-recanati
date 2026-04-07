import { getIO } from "../socket";
import db from "../db";
import type { RideStatus } from "../types/db";
import * as notifications from "../services/notification.service";

/**
 * Broadcast a ride status change to all interested parties.
 * Called after every status transition in ride.service.ts.
 *
 * Sends to:
 *  - ride:{rideId} room (participants who joined)
 *  - user:{customerId} room (always reaches the customer)
 *  - user:{driverUserId} room (always reaches the driver)
 *  - admin room
 */
export async function broadcastRideStatus(
  rideId: string,
  oldStatus: RideStatus | null,
  newStatus: RideStatus,
  rideData?: Record<string, unknown>
) {
  try {
    const io = getIO();

    const payload = {
      ride_id: rideId,
      old_status: oldStatus,
      new_status: newStatus,
      timestamp: new Date().toISOString(),
      ...rideData,
    };

    // 1. Broadcast to ride room (anyone who joined this ride's room)
    io.to(`ride:${rideId}`).emit("ride:status", payload);

    // 2. Broadcast to admin room
    io.to("admin").emit("ride:status", payload);

    // 3. Broadcast directly to the customer's user room
    const customerId = rideData?.customer_id as string | undefined;
    if (customerId) {
      io.to(`user:${customerId}`).emit("ride:status", payload);
    }

    // 4. Broadcast directly to the driver's user room
    const driverId = rideData?.driver_id as string | undefined;
    if (driverId) {
      // driver_id is the drivers table ID, we need the user_id
      const driver = await db("drivers").where("id", driverId).select("user_id").first();
      if (driver) {
        io.to(`user:${driver.user_id}`).emit("ride:status", payload);
      }
    }
  } catch {
    // Socket.io not initialized (e.g. in tests) — silently skip
  }

  // Push notifications (best-effort, non-blocking)
  sendStatusPushNotifications(newStatus, rideData).catch(() => {});
}

const STATUS_MESSAGES_CUSTOMER: Partial<Record<RideStatus, { title: string; body: string }>> = {
  accepted: { title: "Corsa accettata", body: "Un autista ha accettato la tua corsa" },
  arriving: { title: "Autista in arrivo", body: "Il tuo autista sta arrivando" },
  in_progress: { title: "Corsa iniziata", body: "La tua corsa è iniziata" },
  completed: { title: "Corsa completata", body: "Grazie per aver viaggiato con Taxi Recanati!" },
  cancelled: { title: "Corsa annullata", body: "La tua corsa è stata annullata" },
  no_show: { title: "No-show", body: "L'autista non ti ha trovato al punto di ritiro" },
};

async function sendStatusPushNotifications(
  status: RideStatus,
  rideData?: Record<string, unknown>
) {
  if (!rideData) return;

  const customerId = rideData.customer_id as string | undefined;
  const rideId = rideData.id as string | undefined;

  // Notify customer on status changes
  const customerMsg = STATUS_MESSAGES_CUSTOMER[status];
  if (customerMsg && customerId) {
    await notifications.sendToUser(customerId, customerMsg.title, customerMsg.body, {
      type: "ride_status",
      rideId,
      status,
    });
  }
}

/**
 * Send a ride request to a specific driver via their socket room.
 */
export function sendRideRequest(
  driverId: string,
  rideData: Record<string, unknown>,
  timeoutSeconds: number = 30
) {
  try {
    const io = getIO();

    io.to(`driver:${driverId}`).emit("ride:request", {
      ...rideData,
      timeout_seconds: timeoutSeconds,
      sent_at: new Date().toISOString(),
    });
  } catch {
    // Socket.io not initialized — silently skip
  }

  // Push notification for ride request (best-effort)
  const pickup = rideData.pickup_address || "Nuova corsa";
  notifications
    .sendToDriver(driverId, "Nuova richiesta corsa", `Partenza: ${pickup}`, {
      type: "ride_request",
      rideId: rideData.id,
    })
    .catch(() => {});
}
