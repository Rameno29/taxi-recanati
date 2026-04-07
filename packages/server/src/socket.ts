import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { config } from "./config";
import db from "./db";
import type { TokenPayload } from "./types/api";

let io: Server;

interface AuthenticatedSocket extends Socket {
  user: TokenPayload;
  driverId?: string;
}

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 10000,
  });

  // JWT authentication middleware
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
    }

    // Join active ride room (if they already have one)
    const activeRide = await findActiveRide(userId, role, socket.driverId);
    if (activeRide) {
      socket.join(`ride:${activeRide.id}`);
    }

    // Allow clients to join a ride room dynamically
    socket.on("join:ride", (rideId: string) => {
      if (typeof rideId === "string" && rideId.length > 0) {
        socket.join(`ride:${rideId}`);
      }
    });

    socket.on("disconnect", () => {
      // Cleanup handled by Socket.io automatically
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

export type { AuthenticatedSocket };
