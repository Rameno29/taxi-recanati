import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { sensitiveLimiter } from "../middleware/rateLimiter";
import * as adminService from "../services/admin.service";
import * as dispatchService from "../services/dispatch.service";
import { refundPayment } from "../services/payment.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin"));

// ── Validation schemas for admin inputs ────────────────────────────
const updateDriverSchema = z.object({
  status: z.enum(["available", "busy", "offline", "suspended"]).optional(),
  vehicle_type: z.enum(["standard", "monovolume", "premium", "van"]).optional(),
  license_plate: z.string().min(1).max(20).optional(),
}).strict(); // reject unknown fields — prevents mass assignment

const refundSchema = z.object({
  amount: z.number().positive().max(10000), // max 10k refund
});

const dispatchSchema = z.object({
  driverId: z.string().uuid(),
});

const analyticsQuerySchema = z.object({
  period: z.enum(["week", "month", "year"]).default("month"),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

/** GET /api/admin/stats — dashboard stats */
router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/drivers — list all drivers */
router.get("/drivers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const drivers = await adminService.listDrivers(status);
    res.json(drivers);
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/drivers/positions — live driver map positions */
router.get("/drivers/positions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const positions = await adminService.getDriverPositions();
    res.json(positions);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/drivers/:id — update driver (status, vehicle, plate) */
router.patch("/drivers/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate and whitelist allowed fields — blocks mass assignment
    const data = updateDriverSchema.parse(req.body);
    const driver = await adminService.adminUpdateDriver(req.params.id as string, data);
    res.json(driver);
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

/** GET /api/admin/rides — list rides with filters */
router.get("/rides", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await adminService.listRides({
      status: req.query.status as string | undefined,
      driver_id: req.query.driver_id as string | undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/rides/:id/dispatch — manual dispatch a ride to a driver */
router.post("/rides/:id/dispatch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = dispatchSchema.parse(req.body);
    const result = await dispatchService.manualDispatch(
      req.params.id as string,
      driverId,
      req.user!.userId
    );
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

/** POST /api/admin/rides/:id/refund — refund a ride payment (strict rate limit) */
router.post("/rides/:id/refund", sensitiveLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount } = refundSchema.parse(req.body);
    const result = await refundPayment(req.params.id as string, amount);
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

/** GET /api/admin/analytics/revenue — revenue analytics */
router.get("/analytics/revenue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period } = analyticsQuerySchema.parse(req.query);
    const result = await adminService.getRevenueAnalytics(period);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/analytics/drivers — driver performance */
router.get("/analytics/drivers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period } = analyticsQuerySchema.parse(req.query);
    const result = await adminService.getDriverPerformance(period);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/audit — audit log */
router.get("/audit", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await adminService.getAuditLog({
      page,
      limit,
      action_type: req.query.action_type as string | undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
