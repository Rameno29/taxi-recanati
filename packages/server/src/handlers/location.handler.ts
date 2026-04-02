import { Server } from "socket.io";
import db from "../db";
import type { AuthenticatedSocket } from "../socket";

interface LocationData {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

export function registerLocationHandler(io: Server) {
  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;

    if (socket.user.role !== "driver" || !socket.driverId) return;

    socket.on("driver:location", async (data: LocationData) => {
      if (!data.lat || !data.lng) return;

      const driverId = socket.driverId!;

      try {
        // Update driver's current position
        await db("drivers")
          .where("id", driverId)
          .update({
            current_lat: data.lat,
            current_lng: data.lng,
            last_location_at: new Date(),
          });

        // Insert into location history
        const activeRide = await db("rides")
          .where("driver_id", driverId)
          .whereNotIn("status", ["completed", "cancelled", "expired", "no_show"])
          .first();

        await db("driver_locations").insert({
          driver_id: driverId,
          ride_id: activeRide?.id || null,
          lat: data.lat,
          lng: data.lng,
          heading: data.heading || null,
          speed: data.speed || null,
          recorded_at: new Date(),
        });

        // Broadcast to ride room if active
        if (activeRide) {
          io.to(`ride:${activeRide.id}`).emit("driver:location", {
            driver_id: driverId,
            lat: data.lat,
            lng: data.lng,
            heading: data.heading,
            speed: data.speed,
            timestamp: new Date().toISOString(),
          });
        }

        // Broadcast to admin room
        io.to("admin").emit("driver:location", {
          driver_id: driverId,
          lat: data.lat,
          lng: data.lng,
          heading: data.heading,
          speed: data.speed,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit("error", { message: "Failed to update location" });
      }
    });
  });
}
