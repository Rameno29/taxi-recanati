import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";
import authRoutes from "./routes/auth";
import rideRoutes from "./routes/rides";

const app = express();
const httpServer = createServer(app);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  httpServer.listen(config.port, () => {
    console.log(`Taxi Recanati API running on port ${config.port}`);
  });
}

export { app, httpServer };
