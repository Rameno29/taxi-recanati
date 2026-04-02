import { z } from "zod";

export const updateStatusSchema = z.object({
  status: z.enum(["available", "offline", "paused"]),
});

export const pushLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

export const earningsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
