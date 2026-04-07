import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const isDev = (process.env.NODE_ENV || "development") === "development";
const isTest = process.env.NODE_ENV === "test";

// In production, JWT secrets MUST be set via environment variables.
// In dev/test, we generate random secrets per-boot so they're never guessable.
function requireSecret(envVar: string, name: string): string {
  const value = process.env[envVar];
  if (value && value !== "change-me-in-production" && value !== "change-me-refresh-in-production") {
    return value;
  }
  if (!isDev && !isTest) {
    throw new Error(`SECURITY: ${name} (${envVar}) must be set in production!`);
  }
  // Dev/test: generate a random secret per boot — never use a guessable default
  return crypto.randomBytes(64).toString("hex");
}

// Allowed origins for CORS — in production, set ALLOWED_ORIGINS env var
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : isDev
    ? ["http://localhost:5173", "http://localhost:3000", "http://localhost:8081"]
    : [];

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isDev,
  isTest,
  databaseUrl: isTest ? process.env.DATABASE_URL_TEST! : process.env.DATABASE_URL!,
  jwt: {
    secret: requireSecret("JWT_SECRET", "JWT Secret"),
    refreshSecret: requireSecret("JWT_REFRESH_SECRET", "JWT Refresh Secret"),
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  cors: {
    allowedOrigins,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || "",
  },
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
} as const;
