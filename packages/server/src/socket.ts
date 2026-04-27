import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { config } from "./config";
import db from "./db";
import type { TokenPayload } from "./types/api";

let io: Server;

// ── Socket rate limiting (per-connection) ────────────────────────────
const socketRateMap = new Map<string, { count: number; resetAt: number }>();
const SOCKET_RATE_WINDOW = 10_000; // 10 seconds
const SOCKET_RATE_MAX = 50; // max 50 events per 10s per socket

function checkSocketRate(socketId: string): boolean {
  const now = Date.now();
  const entry = socketRateMap.get(socketId);
  if (!entry || now > entry.resetAt) {
    socketRateMap.set(socketId, { count: 1, resetAt: now + SOCKET_RATE_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= SOCKET_RATE_MAX;
}

// Clean up stale rate entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of socketRateMap) {
    if (now > entry.resetAt) socketRateMap.delete(key);
  }
}, 30_000);

interface AuthenticatedSocket extends Socket {
  user: TokenPayload;
  driverId?: string;
}

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.isDev
        ? true // dev: allow all origins (Expo, browser)
        : config.cors.allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 10000,
    // ── Connection security ──────────────────────────────────────────
    maxHttpBufferSize: 1e6, // 1MB max message size
    connectTimeout: 10000,  // 10s connection timeout
  });

  // ── JWT authentication middleware ──────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
      (socket as AuthenticatedSocket).user = payload;

      // If driver, look up driver ID
      if (payload.role === "driver") {
        const driver = await db("drivers").where("user_id", payload.userId).first();
        if (driver) {
          (socket as AuthenticatedSocket).driverId = driver.id;
        }
      }

      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId, role } = socket.user;

    // Every user gets their own room — this ensures they receive
    // events for rides created AFTER their socket connected
    socket.join(`user:${userId}`);

    // Role-based rooms
    if (role === "admin") {
      socket.join("admin");
    }

    if (role === "driver" && socket.driverId) {
      socket.join(`driver:${socket.driverId}`);

      // If the driver is currently `available`, put them in the broadcast
      // room so they see new ride requests as they come in.
      try {
        const driver = await db("drivers")
          .where("id", socket.driverId)
          .select("status")
          .first();
        if (driver?.status === "available") {
          socket.join("drivers:available");
        }
      } catch {
        // DB error — skip
      }
    }

    // Join active ride room (if they already have one)
    const activeRide = await findActiveRide(userId, role, socket.driverId);
    if (activeRide) {
      socket.join(`ride:${activeRide.id}`);
    }

    // ── Authorized ride room join ────────────────────────────────────
    // Verify the user is actually a participant before allowing room join
    socket.on("join:ride", async (rideId: string) => {
      if (typeof rideId !== "string" || rideId.length === 0) return;

      // Rate limit socket events
      if (!checkSocketRate(socket.id)) {
        socket.emit("error", { message: "Rate limit exceeded" });
        return;
      }

      // Admins can join any ride room
      if (role === "admin") {
        socket.join(`ride:${rideId}`);
        return;
      }

      // Verify participation
      try {
        const ride = await db("rides").where("id", rideId).first();
        if (!ride) return;

        const isCustomer = ride.customer_id === userId;
        let isDriver = false;
        if (role === "driver" && socket.driverId) {
          isDriver = ride.driver_id === socket.driverId;
        }

        if (isCustomer || isDriver) {
          socket.join(`ride:${rideId}`);
        }
        // Silently ignore unauthorized join attempts — don't leak info
      } catch {
        // DB error — silently ignore
      }
    });

    socket.on("disconnect", () => {
      socketRateMap.delete(socket.id);
    });
  });

  return io;
}

async function findActiveRide(userId: string, role: string, driverId?: string) {
  const terminalStatuses = ["completed", "cancelled", "expired", "no_show"];

  if (role === "customer") {
    return db("rides")
      .where("customer_id", userId)
      .whereNotIn("status", terminalStatuses)
      .first();
  }

  if ((role === "driver") && driverId) {
    return db("rides")
      .where("driver_id", driverId)
      .whereNotIn("status", terminalStatuses)
      .first();
  }

  return null;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

/**
 * Add/remove a driver's currently-connected sockets from the
 * `drivers:available` broadcast room. Called by driver.service when the
 * driver toggles status online ↔ offline/paused/busy.
 */
export async function setDriverAvailableRoom(userId: string, shouldJoin: boolean) {
  try {
    if (!io) return;
    const room = `user:${userId}`;
    if (shouldJoin) {
      await io.in(room).socketsJoin("drivers:available");
    } else {
      await io.in(room).socketsLeave("drivers:available");
    }
  } catch {
    // Socket.io not initialized or no sockets — silently skip
  }
}

export type { AuthenticatedSocket };
