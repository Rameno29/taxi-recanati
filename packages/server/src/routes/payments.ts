import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import {
  createPaymentSchema,
  refundPaymentSchema,
  syncPaymentMethodSchema,
} from "../validators/payment.validators";
import * as paymentService from "../services/payment.service";
import * as paymentMethodsService from "../services/payment-methods.service";
import { createEphemeralKey } from "../services/stripe-customer.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// Match the Stripe API version the mobile SDK uses — must be kept in sync
// with @stripe/stripe-react-native. See their changelog.
const STRIPE_API_VERSION = "2024-09-30.acacia";

/** POST /api/payments/create-intent — create a payment intent for a ride */
router.post("/create-intent", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rideId, savedPaymentMethodId } = createPaymentSchema.parse(req.body);
    const payment = await paymentService.createPaymentIntent(
      rideId,
      req.user!.userId,
      savedPaymentMethodId
    );
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

// ─── Saved Payment Methods ────────────────────────────────────────────────────
//
// Flow for adding a method:
//   1. client POST /api/payments/setup-intent  → { client_secret, customer, ephemeral_key }
//   2. client opens Stripe PaymentSheet in setup mode using those values
//   3. user picks card / Apple Pay / Google Pay / PayPal and confirms
//   4. client POST /api/payments/methods { stripePaymentMethodId } to mirror it
//   5. setup_intent.succeeded webhook also calls syncPaymentMethod as a backup
//
// Flow for paying with a saved method (one-tap):
//   client POST /api/payments/create-intent { rideId, savedPaymentMethodId }
//     → server confirms off_session; charge happens without UI.

/** POST /api/payments/ephemeral-key — returns {customer, ephemeralKey} for PaymentSheet */
router.post(
  "/ephemeral-key",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await createEphemeralKey(
        req.user!.userId,
        STRIPE_API_VERSION
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  }
);

/** POST /api/payments/setup-intent — create a SetupIntent for saving a method */
router.post(
  "/setup-intent",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentMethodsService.createSetupIntent(
        req.user!.userId
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  }
);

/** GET /api/payments/methods — list the user's saved methods */
router.get(
  "/methods",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const methods = await paymentMethodsService.listPaymentMethods(
        req.user!.userId
      );
      res.json(methods);
    } catch (err) {
      next(err);
    }
  }
);

/** POST /api/payments/methods — mirror a PaymentMethod after client confirmation */
router.post(
  "/methods",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stripePaymentMethodId } = syncPaymentMethodSchema.parse(req.body);
      const method = await paymentMethodsService.syncPaymentMethod(
        req.user!.userId,
        stripePaymentMethodId
      );
      res.status(201).json(method);
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
  }
);

/** DELETE /api/payments/methods/:id — detach and remove a method */
router.delete(
  "/methods/:id",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentMethodsService.deletePaymentMethod(
        req.user!.userId,
        req.params.id as string
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  }
);

/** POST /api/payments/methods/:id/set-default — mark as default */
router.post(
  "/methods/:id/set-default",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const method = await paymentMethodsService.setDefaultPaymentMethod(
        req.user!.userId,
        req.params.id as string
      );
      res.json(method);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      next(err);
    }
  }
);

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
