import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import * as notificationService from "../services/notification.service";

const router = Router();

router.use(authenticate);

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

/** POST /api/notifications/register — register push token */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerTokenSchema.parse(req.body);
    const result = await notificationService.registerPushToken(
      req.user!.userId,
      data.token,
      data.platform
    );
    res.json(result);
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

/** POST /api/notifications/unregister — remove push token (on logout) */
router.post("/unregister", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (token) {
      await notificationService.removePushToken(token);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
