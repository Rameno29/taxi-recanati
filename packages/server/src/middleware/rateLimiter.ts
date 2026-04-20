import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

// In development, all limits are effectively disabled so that dashboards,
// hot reloads, and polling don't exhaust the quota. Production keeps the
// real limits.
const DEV_MAX = 100_000;

/**
 * General API rate limiter — 100 requests per 15 minutes per IP in prod.
 * Skips /api/admin/* — those have their own dedicated adminLimiter applied
 * by the route mount in index.ts, and we don't want to double-count them.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? DEV_MAX : 100,
  standardHeaders: true,
  legacyHeaders: false,
  // req.path is relative to the mount point ("/api"), so admin paths look
  // like "/admin/..." here.
  skip: (req) => req.path.startsWith("/admin"),
  message: {
    error: "TooManyRequests",
    message: "Too many requests, please try again later",
    statusCode: 429,
  },
});

/**
 * Auth endpoint limiter — 10 attempts per 15 minutes per IP in prod.
 * Brute-force protection for login/register/OTP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? DEV_MAX : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: "TooManyRequests",
    message: "Too many auth attempts, please try again later",
    statusCode: 429,
  },
});

/**
 * Admin endpoint limiter — 1000 requests per 15 minutes in prod.
 * Higher than general API since admin dashboards poll frequently.
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? DEV_MAX : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many admin requests, please try again later",
    statusCode: 429,
  },
});

/**
 * Strict limiter for sensitive operations (refunds, password changes).
 * 10 requests per 15 minutes per IP in prod (always enforced even in dev,
 * so we catch buggy retry loops early).
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many requests for sensitive operations, please try again later",
    statusCode: 429,
  },
});
