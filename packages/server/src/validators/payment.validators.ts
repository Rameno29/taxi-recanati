import { z } from "zod";

export const createPaymentSchema = z.object({
  rideId: z.string().uuid(),
});

export const refundPaymentSchema = z.object({
  rideId: z.string().uuid(),
  amount: z.number().positive().optional(),
});
