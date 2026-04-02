import { RideStatus, RideType, VehicleType } from "./db";

/** Valid state transitions for rides */
export const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  pending: ["accepted", "cancelled", "expired"],
  accepted: ["arriving", "cancelled"],
  arriving: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  expired: [],
  no_show: [],
};

export const TERMINAL_STATUSES: RideStatus[] = [
  "completed",
  "cancelled",
  "expired",
  "no_show",
];

export interface RideCreateInput {
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  destination_lat: number;
  destination_lng: number;
  destination_address?: string;
  type: RideType;
  scheduled_at?: string;
  vehicle_type: VehicleType;
}

export interface FareEstimateInput {
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  vehicle_type: VehicleType;
}

export interface RideStatusUpdate {
  status: RideStatus;
  cancellation_reason?: string;
}

export interface PricingSnapshot {
  rule_id: string;
  base_fare: number;
  per_km: number;
  per_minute: number;
  night_surcharge_pct: number;
  minimum_fare: number;
  cancellation_fee: number;
  reservation_fee: number;
  vehicle_type_multiplier: Record<string, number>;
  captured_at: string;
}

export interface FareBreakdown {
  base_fare: number;
  distance_charge: number;
  time_charge: number;
  night_surcharge: number;
  vehicle_multiplier: number;
  subtotal: number;
  estimated_fare: number;
  minimum_fare_applied: boolean;
  is_fixed_route: boolean;
  fixed_route_min?: number;
  fixed_route_max?: number;
}
