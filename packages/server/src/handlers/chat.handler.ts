import { Server } from "socket.io";
import db from "../db";
import type { AuthenticatedSocket } from "../socket";

interface ChatMessageData {
  ride_id: string;
  body: string;
}

export function registerChatHandler(io: Server) {
  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;

    socket.on("chat:message", async (data: ChatMessageData) => {
      if (!data.ride_id || !data.body?.trim()) return;

      const userId = socket.user.userId;

      try {
        // Verify user is a participant in this ride
        const ride = await db("rides").where("id", data.ride_id).first();
        if (!ride) return;

        const isCustomer = ride.customer_id === userId;
        let isDriver = false;
        if (ride.driver_id) {
          const driver = await db("drivers").where("id", ride.driver_id).first();
          isDriver = driver?.user_id === userId;
        }
        const isAdmin = socket.user.role === "admin";

        if (!isCustomer && !isDriver && !isAdmin) return;

        // Insert message
        const [message] = await db("messages")
          .insert({
            ride_id: data.ride_id,
            sender_id: userId,
            message_type: "text",
            body: data.body.trim(),
          })
          .returning("*");

        // Get sender name
        const sender = await db("users").where("id", userId).select("name").first();

        const payload = {
          id: message.id,
          ride_id: message.ride_id,
          sender_id: message.sender_id,
          sender_name: sender?.name || "Unknown",
          message_type: message.message_type,
          body: message.body,
          created_at: message.created_at,
        };

        // Broadcast to ride room
        io.to(`ride:${data.ride_id}`).emit("chat:message", payload);

        // Also notify admin
        io.to("admin").emit("chat:message", payload);
      } catch (err) {
        socket.emit("error", { message: "Failed to send message" });
      }
    });
  });
}
