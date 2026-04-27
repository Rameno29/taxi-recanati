// ── Enums ──
export type UserRole = "customer" | "driver" | "admin";
export type UserLanguage = "it" | "en";
export type DriverStatus = "offline" | "available" | "busy" | "paused" | "suspended";
export type VehicleType = "standard" | "monovolume" | "premium" | "van";
export type RideType = "immediate" | "reservation" | "tour";
export type RideStatus = "payment_pending" | "pending" | "accepted" | "arriving" | "in_progress" | "completed" | "cancelled" | "expired" | "no_show";
export type DispatchMode = "auto" | "manual";
export type PaymentStatus = "pending" | "authorized" | "captured" | "refunded" | "failed";
export type DispatchResponse = "accepted" | "declined" | "timeout";
export type DispatchTrigger = "system" | "admin";
export type MessageType = "text" | "system";
export type PlatformType = "ios" | "android";
export type TourCategory = "culture" | "food_wine" | "nature" | "outlet";

// ── Table Row Types ──
export interface UserRow {
  id: string;
  role: UserRole;
  name: string;
  email: string | null;
  phone: string;
  password_hash: string | null;
  language: UserLanguage;
  avatar: string | null;
  created_at: Date;
}

export interface DriverRow {
  id: string;
  user_id: string;
  license_plate: string;
  vehicle_type: VehicleType;
  vehicle_model: string | null;
  vehicle_color: string | null;
  max_capacity: number;
  status: DriverStatus;
  is_verified: boolean;
  service_zone: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_at: Date | null;
}

export interface ZoneRow {
  id: string;
  name: string;
  city: string;
  polygon: string;
  active: boolean;
}

export interface FixedRouteRow {
  id: string;
  name: string;
  origin_zone_id: string;
  destination_zone_id: string;
  min_price: number;
  max_price: number;
}

export interface PricingRuleRow {
  id: string;
  base_fare: number;
  per_km: number;
  per_minute: number;
  night_surcharge_pct: number;
  minimum_fare: number;
  cancellation_fee: number;
  reservation_fee: number;
  vehicle_type_multiplier: Record<VehicleType, number>;
  time_window: string | null;
  updated_by: string | null;
  updated_at: Date;
}

export interface RideRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  type: RideType;
  status: RideStatus;
  dispatch_mode: DispatchMode;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  pickup_address: string;
  destination_address: string;
  scheduled_at: Date | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  fare_estimate: number | null;
  fare_final: number | null;
  currency: string;
  pricing_snapshot_json: PricingRuleRow | null;
  payment_status: PaymentStatus;
  tour_category: TourCategory | null;
  customer_rating: number | null;
  customer_feedback_text: string | null;
  driver_rating: number | null;
  driver_feedback_text: string | null;
  rated_at: Date | null;
  requested_at: Date;
  accepted_at: Date | null;
  arriving_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: Date;
}

export interface RideStatusHistoryRow {
  id: string;
  ride_id: string;
  old_status: RideStatus | null;
  new_status: RideStatus;
  changed_by_user_id: string | null;
  changed_by_system: boolean;
  created_at: Date;
}

export interface RideDispatchAttemptRow {
  id: string;
  ride_id: string;
  driver_id: string;
  attempt_no: number;
  sent_at: Date;
  responded_at: Date | null;
  response: DispatchResponse | null;
  triggered_by: DispatchTrigger;
  timeout_seconds: number;
}

export interface DriverLocationRow {
  id: string;
  driver_id: string;
  ride_id: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  recorded_at: Date;
}

export interface MessageRow {
  id: string;
  ride_id: string;
  sender_id: string;
  message_type: MessageType;
  body: string;
  read_at: Date | null;
  created_at: Date;
}

export interface PaymentRow {
  id: string;
  ride_id: string;
  provider: string;
  stripe_payment_intent_id: string | null;
  amount: number;
  captured_amount: number;
  refunded_amount: number;
  currency: string;
  payment_method_type: string | null;
  status: PaymentStatus;
  failure_reason: string | null;
  paid_at: Date | null;
  webhook_event_id: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: PlatformType;
}

export interface AdminActionRow {
  id: string;
  admin_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: Date;
}
