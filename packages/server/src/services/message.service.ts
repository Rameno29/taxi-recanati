import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { getIO } from "../socket";
import * as notifications from "./notification.service";

/**
 * Get all messages for a ride.
 */
export async function getMessagesByRide(rideId: string, userId: string, userRole: string) {
  // Verify ride exists and user is a participant
  const ride = await db("rides").where("id", rideId).first();
  if (!ride) throw new AppError(404, "Ride not found");

  if (userRole !== "admin") {
    const isCustomer = ride.customer_id === userId;
    let isDriver = false;
    if (ride.driver_id) {
      const driver = await db("drivers").where("id", ride.driver_id).first();
      isDriver = driver?.user_id === userId;
    }
    if (!isCustomer && !isDriver) {
      throw new AppError(403, "Not authorized to view messages for this ride");
    }
  }

  const messages = await db("messages as m")
    .join("users as u", "m.sender_id", "u.id")
    .where("m.ride_id", rideId)
    .select("m.*", "u.name as sender_name")
    .orderBy("m.created_at", "asc");

  return messages;
}

/**
 * Send a message in a ride chat.
 */
export async function sendMessage(
  rideId: string,
  senderId: string,
  senderRole: string,
  body: string
) {
  const ride = await db("rides").where("id", rideId).first();
  if (!ride) throw new AppError(404, "Ride not found");

  // Verify sender is participant
  if (senderRole !== "admin") {
    const isCustomer = ride.customer_id === senderId;
    let isDriver = false;
    if (ride.driver_id) {
      const driver = await db("drivers").where("id", ride.driver_id).first();
      isDriver = driver?.user_id === senderId;
    }
    if (!isCustomer && !isDriver) {
      throw new AppError(403, "Not authorized to send messages in this ride");
    }
  }

  const [message] = await db("messages")
    .insert({
      ride_id: rideId,
      sender_id: senderId,
      message_type: "text",
      body: body.trim(),
    })
    .returning("*");

  // Get sender name for broadcast payload
  const sender = await db("users").where("id", senderId).select("name").first();

  const payload = {
    id: message.id,
    ride_id: message.ride_id,
    sender_id: message.sender_id,
    sender_name: sender?.name || "Unknown",
    message_type: message.message_type,
    body: message.body,
    created_at: message.created_at,
  };

  // Broadcast to ride room via Socket.io (so other participants receive it in real time)
  try {
    const io = getIO();
    io.to(`ride:${rideId}`).emit("chat:message", payload);
    io.to("admin").emit("chat:message", payload);
  } catch {
    // Socket not initialized — skip broadcast (shouldn't happen in prod)
  }

  // Push notification to the other participant
  const isCustomer = ride.customer_id === senderId;
  let recipientId: string | null = null;
  if (isCustomer && ride.driver_id) {
    const driver = await db("drivers").where("id", ride.driver_id).first();
    recipientId = driver?.user_id || null;
  } else if (!isCustomer) {
    recipientId = ride.customer_id;
  }

  if (recipientId) {
    notifications
      .sendToUser(recipientId, sender?.name || "Messaggio", message.body, {
        type: "chat_message",
        rideId,
      })
      .catch(() => {});
  }

  return payload;
}

/**
 * Mark a message as read.
 */
export async function markMessageRead(messageId: string, userId: string) {
  const message = await db("messages").where("id", messageId).first();
  if (!message) throw new AppError(404, "Message not found");

  // Only the recipient can mark as read (not the sender)
  if (message.sender_id === userId) {
    throw new AppError(400, "Cannot mark your own message as read");
  }

  const [updated] = await db("messages")
    .where("id", messageId)
    .update({ read_at: new Date() })
    .returning("*");

  return updated;
}
