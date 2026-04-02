import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";
import authRoutes from "./routes/auth";
import rideRoutes from "./routes/rides";
import messageRoutes from "./routes/messages";
import driverRoutes from "./routes/drivers";
import paymentRoutes from "./routes/payments";
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

app.use(helmet());
app.use(cors());

// Raw body for Stripe webhook signature verification
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, _res, next) => {
  (req as any).rawBody = req.body;
  next();
});

app.use(express.json());
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/payments", paymentRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(config.port, () => {
    console.log(`Taxi Recanati API running on port ${config.port}`);
  });
}

export { app, httpServer, io };
