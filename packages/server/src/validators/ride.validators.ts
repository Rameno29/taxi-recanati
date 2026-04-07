import { z } from "zod";

export const createRideSchema = z
  .object({
    pickup_lat: z.number().min(-90).max(90),
    pickup_lng: z.number().min(-180).max(180),
    pickup_address: z.string().optional(),
    destination_lat: z.number().min(-90).max(90),
    destination_lng: z.number().min(-180).max(180),
    destination_address: z.string().optional(),
    type: z.enum(["immediate", "reservation"]),
    scheduled_at: z.string().datetime().optional().nullable(),
    vehicle_type: z.enum(["standard", "monovolume", "premium", "van"]),
  })
  .refine(
    (data) => {
      if (data.type === "reservation" && !data.scheduled_at) {
        return false;
      }
      return true;
    },
    { message: "scheduled_at is required for reservations", path: ["scheduled_at"] }
  );

export const fareEstimateSchema = z.object({
  pickup_lat: z.number().min(-90).max(90),
  pickup_lng: z.number().min(-180).max(180),
  destination_lat: z.number().min(-90).max(90),
  destination_lng: z.number().min(-180).max(180),
  vehicle_type: z.enum(["standard", "monovolume", "premium", "van"]),
});

export const updateStatusSchema = z
  .object({
    status: z.enum([
      "pending",
      "accepted",
      "arriving",
      "in_progress",
      "completed",
      "cancelled",
      "expired",
      "no_show",
    ]),
    cancellation_reason: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.status === "cancelled" && !data.cancellation_reason) {
        return false;
      }
      return true;
    },
    { message: "cancellation_reason is required when cancelling", path: ["cancellation_reason"] }
  );

export const rateRideSchema = z.object({
  customer_rating: z.number().int().min(1).max(5),
  customer_feedback_text: z.string().max(1000).optional(),
});

export const manualDispatchSchema = z.object({
  driverId: z.string().uuid(),
});
