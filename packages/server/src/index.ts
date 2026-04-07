import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter, adminLimiter } from "./middleware/rateLimiter";
import authRoutes from "./routes/auth";
import rideRoutes from "./routes/rides";
import messageRoutes from "./routes/messages";
import driverRoutes from "./routes/drivers";
import paymentRoutes from "./routes/payments";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notifications";
import { initializeSocket } from "./socket";
import { registerLocationHandler } from "./handlers/location.handler";
import { registerChatHandler } from "./handlers/chat.handler";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io (skip in test to avoid port conflicts)
let io;
if (process.env.NODE_ENV !== "test") {
  io = initializeSocket(httpServer);
  registerLocationHandler(io);
  registerChatHandler(io);
}

// ── Security headers ───────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: config.isDev ? false : undefined,
    crossOriginEmbedderPolicy: false, // allow mobile apps
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

// ── CORS — restrict to known origins ───────────────────────────────
app.use(
  cors({
    origin: config.isDev
      ? (origin, cb) => cb(null, true) // dev: allow all (Expo, browser, etc.)
      : config.cors.allowedOrigins,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400, // preflight cache 24h
  })
);

// ── Payload size limits ────────────────────────────────────────────
// Raw body for Stripe webhook signature verification (before json parser)
app.use("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), (req, _res, next) => {
  (req as any).rawBody = req.body;
  next();
});

app.use(express.json({ limit: "1mb" }));   // 1MB max JSON body
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ── Rate limiting ──────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use("/api/admin", adminLimiter); // stricter limit for admin operations

// ── Health check (no auth) ─────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Disable tech fingerprinting ────────────────────────────────────
app.disable("x-powered-by");

// ── Routes ─────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(config.port, () => {
    console.log(`Taxi Recanati API running on port ${config.port}`);
  });
}

export { app, httpServer, io };
