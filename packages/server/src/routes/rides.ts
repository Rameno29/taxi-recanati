import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import {
  createRideSchema,
  fareEstimateSchema,
  updateStatusSchema,
  rateRideSchema,
  manualDispatchSchema,
} from "../validators/ride.validators";
import * as rideService from "../services/ride.service";
import * as pricingService from "../services/pricing.service";
import * as dispatchService from "../services/dispatch.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// All ride routes require authentication
router.use(authenticate);

/** POST /api/rides/estimate — fare estimate */
router.post("/estimate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = fareEstimateSchema.parse(req.body);

    const pricingRule = await pricingService.getActivePricingRule();

    // Check fixed route first
    const fixedRoute = await pricingService.checkFixedRoute(
      data.pickup_lat, data.pickup_lng,
      data.destination_lat, data.destination_lng
    );

    if (fixedRoute) {
      return res.json({
        is_fixed_route: true,
        fixed_route_name: fixedRoute.name,
        min_price: Number(fixedRoute.min_price),
        max_price: Number(fixedRoute.max_price),
      });
    }

    // Haversine estimate (Google Maps Distance Matrix will replace this)
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(data.destination_lat - data.pickup_lat);
    const dLng = toRad(data.destination_lng - data.pickup_lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(data.pickup_lat)) *
        Math.cos(toRad(data.destination_lat)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;
    const durationSeconds = (distanceMeters / 1000 / 40) * 3600;

    const breakdown = pricingService.calculateFare(
      distanceMeters, durationSeconds, data.vehicle_type, pricingRule
    );

    res.json(breakdown);
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

/** POST /api/rides — create ride (customer only) */
router.post("/", requireRole("customer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createRideSchema.parse(req.body);
    const result = await rideService.createRide(req.user!.userId, data);
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

/** GET /api/rides/active — get current active ride */
router.get("/active", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await rideService.getActiveRide(req.user!.userId);
    if (!ride) {
      return res.json(null);
    }
    res.json(ride);
  } catch (err) {
    next(err);
  }
});

/** GET /api/rides/history — paginated ride history */
router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await rideService.getRideHistory(req.user!.userId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/rides/:id — get ride details */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ride = await rideService.getRideById(req.params.id as string);
    if (!ride) {
      throw new AppError(404, "Ride not found");
    }

    // Authorization: must be participant or admin
    const userId = req.user!.userId;
    const role = req.user!.role;
    if (role !== "admin" && ride.customer_id !== userId) {
      // Check if user is the driver
      const isDriver = ride.driver_id && ride.driver_user_id === userId;
      if (!isDriver) {
        throw new AppError(403, "Not authorized to view this ride");
      }
    }

    res.json(ride);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** PATCH /api/rides/:id/status — update ride status */
router.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateStatusSchema.parse(req.body);
    const userId = req.user!.userId;
    const role = req.user!.role;

    // ── Authorization check: only participants or admins can update ──
    const existingRide = await rideService.getRideById(req.params.id as string);
    if (!existingRide) {
      throw new AppError(404, "Ride not found");
    }

    if (role === "customer") {
      // Customers can only cancel their own rides
      if (existingRide.customer_id !== userId) {
        throw new AppError(403, "Not authorized to update this ride");
      }
      if (data.status !== "cancelled") {
        throw new AppError(403, "Customers can only cancel rides");
      }
    } else if (role === "driver") {
      // Drivers can only update rides assigned to them
      const isAssignedDriver = existingRide.driver_user_id === userId;
      if (!isAssignedDriver) {
        throw new AppError(403, "Not authorized to update this ride");
      }
    }
    // Admins can update any ride

    const ride = await rideService.updateRideStatus(
      req.params.id as string,
      data,
      userId,
      role
    );
    res.json(ride);
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

/** POST /api/rides/:id/rate — rate a completed ride (customer only) */
router.post("/:id/rate", requireRole("customer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = rateRideSchema.parse(req.body);
    const ride = await rideService.rateRide(
      req.params.id as string,
      req.user!.userId,
      data.customer_rating,
      data.customer_feedback_text
    );
    res.json(ride);
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

/** POST /api/rides/:id/dispatch — manual admin dispatch */
router.post("/:id/dispatch", requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { driverId } = manualDispatchSchema.parse(req.body);
    const ride = await dispatchService.manualDispatch(
      req.params.id as string,
      driverId,
      req.user!.userId
    );
    res.json(ride);
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

export default router;
