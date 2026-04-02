export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "driver" | "admin";
}

export interface Driver {
  id: string;
  user_id: string;
  license_plate: string;
  vehicle_type: "standard" | "premium" | "van";
  status: "available" | "busy" | "offline";
  current_lat: number | null;
  current_lng: number | null;
}

export interface Ride {
  id: string;
  customer_id: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  type: "immediate" | "reservation";
  scheduled_at: string | null;
  vehicle_type: "standard" | "premium" | "van";
  status: RideStatus;
  fare_estimate: number;
  fare_final: number | null;
  distance_meters: number;
  duration_seconds: number;
  customer_name?: string;
  customer_phone?: string;
  created_at: string;
}

export type RideStatus =
  | "pending"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired"
  | "no_show";

export interface Message {
  id: string;
  ride_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface EarningsSummary {
  today: number;
  week: number;
  month: number;
  total_rides_today: number;
  total_rides_week: number;
  total_rides_month: number;
}

export interface Location {
  latitude: number;
  longitude: number;
}
