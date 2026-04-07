import rateLimit from "express-rate-limit";

/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many requests, please try again later",
    statusCode: 429,
  },
});

/**
 * Auth endpoint limiter — 5 attempts per 15 minutes per IP.
 * Brute-force protection for login/register/OTP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
 * Admin endpoint limiter — 200 requests per 15 minutes.
 * Higher than general API but still bounded.
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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
 * 5 requests per 15 minutes per IP.
 */
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many requests for sensitive operations, please try again later",
    statusCode: 429,
  },
});
