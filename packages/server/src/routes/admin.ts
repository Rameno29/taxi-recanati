import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import * as adminService from "../services/admin.service";
import * as dispatchService from "../services/dispatch.service";
import { refundPayment } from "../services/payment.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.use(authenticate);
router.use(requireRole("admin"));

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
    const driver = await adminService.adminUpdateDriver(req.params.id as string, req.body);
    res.json(driver);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** GET /api/admin/rides — list rides with filters */
router.get("/rides", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.listRides({
      status: req.query.status as string | undefined,
      driver_id: req.query.driver_id as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/rides/:id/dispatch — manual dispatch a ride to a driver */
router.post("/rides/:id/dispatch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ error: "driverId is required" });
    }
    const result = await dispatchService.manualDispatch(
      req.params.id as string,
      driverId,
      req.user!.userId
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** POST /api/admin/rides/:id/refund — refund a ride payment */
router.post("/rides/:id/refund", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await refundPayment(req.params.id as string, req.body.amount);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

export default router;
