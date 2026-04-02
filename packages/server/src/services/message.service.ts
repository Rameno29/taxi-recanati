import db from "../db";
import { AppError } from "../middleware/errorHandler";

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

  return message;
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
