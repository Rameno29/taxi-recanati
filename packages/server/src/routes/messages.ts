import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth";
import { sendMessageSchema } from "../validators/message.validators";
import * as messageService from "../services/message.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.use(authenticate);

/** GET /api/messages/:rideId — list messages for a ride */
router.get("/:rideId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await messageService.getMessagesByRide(
      req.params.rideId as string,
      req.user!.userId,
      req.user!.role
    );
    res.json(messages);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

/** POST /api/messages/:rideId — send a message */
router.post("/:rideId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = sendMessageSchema.parse(req.body);
    const message = await messageService.sendMessage(
      req.params.rideId as string,
      req.user!.userId,
      req.user!.role,
      body
    );
    res.status(201).json(message);
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

/** PATCH /api/messages/:messageId/read — mark message as read */
router.patch("/:messageId/read", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = await messageService.markMessageRead(
      req.params.messageId as string,
      req.user!.userId
    );
    res.json(message);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(err);
  }
});

export default router;
