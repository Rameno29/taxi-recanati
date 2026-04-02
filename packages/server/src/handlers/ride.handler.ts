import { getIO } from "../socket";
import type { RideStatus } from "../types/db";

/**
 * Broadcast a ride status change to all interested parties.
 * Called after every status transition in ride.service.ts.
 */
export function broadcastRideStatus(
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

    // Broadcast to ride room (customer + driver)
    io.to(`ride:${rideId}`).emit("ride:status", payload);

    // Broadcast to admin room
    io.to("admin").emit("ride:status", payload);
  } catch {
    // Socket.io not initialized (e.g. in tests) — silently skip
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
}
