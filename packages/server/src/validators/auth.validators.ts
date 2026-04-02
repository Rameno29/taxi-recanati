import { z } from "zod";

export const registerSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format (e.g. +393271234567)"),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  language: z.enum(["it", "en"]).optional().default("it"),
});

export const loginEmailSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const requestOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format"),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format"),
  code: z.string().length(6, "OTP code must be 6 digits"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
