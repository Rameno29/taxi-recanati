import { Router, Request, Response, NextFunction } from "express";
import { authLimiter } from "../middleware/rateLimiter";
import { authenticate } from "../middleware/auth";
import {
  registerSchema,
  loginEmailSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
} from "../validators/auth.validators";
import * as authService from "../services/auth.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.post("/register", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

router.post("/login/email", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginEmailSchema.parse(req.body);
    const result = await authService.loginWithEmail(email, password);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

router.post("/otp/request", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = requestOtpSchema.parse(req.body);
    // Dev mode: OTP is stubbed. In production, wire up Twilio Verify.
    res.json({ message: "OTP sent", phone });
  } catch (err) {
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

router.post("/otp/verify", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = verifyOtpSchema.parse(req.body);
    if (code.length !== 6) {
      throw new AppError(401, "Invalid OTP code");
    }
    const result = await authService.loginWithPhone(phone);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserById(req.user!.userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      language: user.language,
      avatar: user.avatar,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
