import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { updateStatusSchema, pushLocationSchema, createDriverProfileSchema } from "../validators/driver.validators";
import * as driverService from "../services/driver.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.use(authenticate);

/** GET /api/drivers/active-positions — public (any authenticated user):
 *  nearby available drivers for the customer map. No PII. */
router.get("/active-positions", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const positions = await driverService.getActivePositionsPublic();
    res.json(positions);
  } catch (err) {
    next(err);
  }
});

/** POST /api/drivers/profile — create driver profile */
router.post("/profile", requireRole("driver", "admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createDriverProfileSchema.parse(req.body);
    const driver = await driverService.createDriverProfile(
      req.user!.userId,
      data.license_plate,
      data.vehicle_type
    );
    res.status(201).json(driver);
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

/** GET /api/drivers/me — get own driver profile */
router.get("/me", requireRole("driver", "admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driver = await driverService.getDriverProfile(req.user!.userId);
    res.json(driver);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** PATCH /api/drivers/status — update own availability status */
router.patch("/status", requireRole("driver"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const driver = await driverService.updateDriverStatus(req.user!.userId, status);
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

/** POST /api/drivers/location — push GPS via REST fallback */
router.post("/location", requireRole("driver"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = pushLocationSchema.parse(req.body);
    const result = await driverService.pushLocation(
      req.user!.userId,
      data.lat,
      data.lng,
      data.heading,
      data.speed
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

/** GET /api/drivers/earnings — get earnings with optional date range */
router.get("/earnings", requireRole("driver"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const earnings = await driverService.getEarnings(req.user!.userId, from, to);
    res.json(earnings);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

export default router;
