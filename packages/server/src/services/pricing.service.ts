import db from "../db";
import type { PricingRuleRow, FixedRouteRow } from "../types/db";
import type { PricingSnapshot, FareBreakdown } from "../types/rides";

/**
 * Get the currently active pricing rule.
 * Prefers a rule with a time_window containing NOW; falls back to the one with null time_window.
 */
export async function getActivePricingRule(): Promise<PricingRuleRow> {
  // Try specific time window first
  const specific: PricingRuleRow | undefined = await db("pricing_rules")
    .whereRaw("time_window @> now()::timestamptz")
    .first();

  if (specific) return specific;

  // Fallback to default (null time_window)
  const fallback: PricingRuleRow | undefined = await db("pricing_rules")
    .whereNull("time_window")
    .orderBy("updated_at", "desc")
    .first();

  if (!fallback) {
    throw new Error("No active pricing rule found");
  }

  return fallback;
}

/**
 * Check if pickup and dropoff coordinates match a fixed route.
 * Uses PostGIS ST_Contains to check if points fall within zone polygons.
 */
export async function checkFixedRoute(
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number
): Promise<(FixedRouteRow & { origin_zone_name: string; destination_zone_name: string }) | null> {
  const result = await db("fixed_routes as fr")
    .join("zones as oz", "fr.origin_zone_id", "oz.id")
    .join("zones as dz", "fr.destination_zone_id", "dz.id")
    .whereRaw("ST_Contains(oz.polygon, ST_SetSRID(ST_MakePoint(?, ?), 4326))", [pickupLng, pickupLat])
    .whereRaw("ST_Contains(dz.polygon, ST_SetSRID(ST_MakePoint(?, ?), 4326))", [dropoffLng, dropoffLat])
    .where("oz.active", true)
    .where("dz.active", true)
    .select(
      "fr.*",
      "oz.name as origin_zone_name",
      "dz.name as destination_zone_name"
    )
    .first();

  return result || null;
}

/**
 * Calculate fare based on distance, duration, vehicle type, and pricing rule.
 * Uses integer cents internally to avoid floating-point errors.
 */
export function calculateFare(
  distanceMeters: number,
  durationSeconds: number,
  vehicleType: string,
  pricingRule: PricingRuleRow
): FareBreakdown {
  const distanceKm = distanceMeters / 1000;
  const durationMin = durationSeconds / 60;

  const multipliers =
    typeof pricingRule.vehicle_type_multiplier === "string"
      ? JSON.parse(pricingRule.vehicle_type_multiplier)
      : pricingRule.vehicle_type_multiplier;

  const vehicleMultiplier = multipliers[vehicleType] ?? 1.0;

  // All calculations in cents
  const baseFareCents = Math.round(Number(pricingRule.base_fare) * 100);
  const distanceChargeCents = Math.round(Number(pricingRule.per_km) * distanceKm * 100);
  const timeChargeCents = Math.round(Number(pricingRule.per_minute) * durationMin * 100);

  const subtotalCents = Math.round(
    (baseFareCents + distanceChargeCents + timeChargeCents) * vehicleMultiplier
  );

  // Night surcharge: 22:00 - 06:00
  const currentHour = new Date().getHours();
  const isNight = currentHour >= 22 || currentHour < 6;
  const nightSurchargeCents = isNight
    ? Math.round(subtotalCents * (Number(pricingRule.night_surcharge_pct) / 100))
    : 0;

  const totalCents = subtotalCents + nightSurchargeCents;
  const minimumFareCents = Math.round(Number(pricingRule.minimum_fare) * 100);
  const minimumApplied = totalCents < minimumFareCents;
  const finalCents = minimumApplied ? minimumFareCents : totalCents;

  return {
    base_fare: baseFareCents / 100,
    distance_charge: distanceChargeCents / 100,
    time_charge: timeChargeCents / 100,
    night_surcharge: nightSurchargeCents / 100,
    vehicle_multiplier: vehicleMultiplier,
    subtotal: subtotalCents / 100,
    estimated_fare: finalCents / 100,
    minimum_fare_applied: minimumApplied,
    is_fixed_route: false,
  };
}

/**
 * Build a pricing snapshot to store in the ride's pricing_snapshot_json.
 */
export function buildPricingSnapshot(rule: PricingRuleRow): PricingSnapshot {
  const multipliers =
    typeof rule.vehicle_type_multiplier === "string"
      ? JSON.parse(rule.vehicle_type_multiplier)
      : rule.vehicle_type_multiplier;

  return {
    rule_id: rule.id,
    base_fare: Number(rule.base_fare),
    per_km: Number(rule.per_km),
    per_minute: Number(rule.per_minute),
    night_surcharge_pct: Number(rule.night_surcharge_pct),
    minimum_fare: Number(rule.minimum_fare),
    cancellation_fee: Number(rule.cancellation_fee),
    reservation_fee: Number(rule.reservation_fee),
    vehicle_type_multiplier: multipliers,
    captured_at: new Date().toISOString(),
  };
}
