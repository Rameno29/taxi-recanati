import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { createPaymentSchema, refundPaymentSchema } from "../validators/payment.validators";
import * as paymentService from "../services/payment.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

/** POST /api/payments/create-intent — create a payment intent for a ride */
router.post("/create-intent", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rideId } = createPaymentSchema.parse(req.body);
    const payment = await paymentService.createPaymentIntent(rideId, req.user!.userId);
    res.status(201).json(payment);
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

/** POST /api/payments/:id/confirm — confirm payment authorization */
router.post("/:id/confirm", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.confirmPayment(req.params.id as string);
    res.json(payment);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** GET /api/payments/ride/:rideId — get payment for a ride */
router.get("/ride/:rideId", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await paymentService.getPaymentByRide(req.params.rideId as string);
    if (!payment) throw new AppError(404, "No payment found for this ride");
    res.json(payment);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** POST /api/payments/refund — refund a payment (admin only) */
router.post("/refund", authenticate, requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rideId, amount } = refundPaymentSchema.parse(req.body);
    const payment = await paymentService.refundPayment(rideId, amount);
    res.json(payment);
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

/** POST /api/payments/webhook — Stripe webhook (no auth, raw body) */
router.post("/webhook",
  // Raw body is needed for signature verification — must be configured in index.ts
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      if (!sig) throw new AppError(400, "Missing stripe-signature header");

      const result = await paymentService.handleWebhook(
        (req as any).rawBody,
        sig
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  }
);

export default router;
