import db from "../db";
import { AppError } from "../middleware/errorHandler";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
}

/**
 * Register or update a push token for a user.
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: "ios" | "android"
) {
  // Upsert: if token exists for this user, update; otherwise insert
  const existing = await db("push_tokens").where("token", token).first();

  if (existing) {
    if (existing.user_id !== userId) {
      // Token transferred to a new user (e.g., logged out + logged in)
      await db("push_tokens").where("id", existing.id).update({ user_id: userId, platform });
    }
    return existing;
  }

  const [record] = await db("push_tokens")
    .insert({ user_id: userId, token, platform })
    .returning("*");

  return record;
}

/**
 * Remove a push token (on logout).
 */
export async function removePushToken(token: string) {
  await db("push_tokens").where("token", token).delete();
}

/**
 * Get all push tokens for a user.
 */
async function getUserTokens(userId: string): Promise<string[]> {
  const rows = await db("push_tokens").where("user_id", userId).select("token");
  return rows.map((r: any) => r.token);
}

/**
 * Send push notification to a specific user.
 */
export async function sendToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const tokens = await getUserTokens(userId);
  if (tokens.length === 0) return;

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data,
    sound: "default" as const,
  }));

  await sendPushMessages(messages);
}

/**
 * Send push notification to multiple users.
 */
export async function sendToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  for (const userId of userIds) {
    await sendToUser(userId, title, body, data);
  }
}

/**
 * Send push notification to a driver by driver ID (not user ID).
 */
export async function sendToDriver(
  driverId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const driver = await db("drivers").where("id", driverId).first();
  if (!driver) return;
  await sendToUser(driver.user_id, title, body, data);
}

/**
 * Batch send to Expo Push API.
 */
async function sendPushMessages(messages: PushMessage[]) {
  if (messages.length === 0) return;

  // Filter to only valid Expo push tokens
  const validMessages = messages.filter((m) =>
    m.to.startsWith("ExponentPushToken[") || m.to.startsWith("ExpoPushToken[")
  );

  if (validMessages.length === 0) return;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(validMessages),
    });

    if (!res.ok) {
      console.error("Expo push error:", res.status, await res.text());
    }
  } catch (err) {
    // Push is best-effort — don't crash the app
    console.error("Push notification failed:", err);
  }
}
