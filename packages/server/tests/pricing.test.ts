import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";
import type { PricingRuleRow } from "../src/types/db";

const db: Knex = knexLib(knexConfig.test);

// Shared reference for the mock — must use require to avoid hoisting issues
jest.mock("../src/db", () => {
  const k = require("knex");
  const cfg = require("../knexfile");
  const instance = k(cfg.default ? cfg.default.test : cfg.test);
  return { __esModule: true, default: instance };
});

import { calculateFare, checkFixedRoute, getActivePricingRule, buildPricingSnapshot } from "../src/services/pricing.service";
import { createTestPricingRule, cleanTables } from "./helpers";

beforeAll(async () => {
  await db.migrate.latest();
});

afterAll(async () => {
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

beforeEach(async () => {
  await cleanTables(db)();
});

describe("calculateFare", () => {
  const basePricingRule = {
    id: "test-rule",
    base_fare: 5.0,
    per_km: 1.2,
    per_minute: 0.3,
    night_surcharge_pct: 20.0,
    minimum_fare: 8.0,
    cancellation_fee: 5.0,
    reservation_fee: 3.0,
    vehicle_type_multiplier: { standard: 1.0, monovolume: 1.3 },
  } as unknown as PricingRuleRow;

  const realDate = global.Date;

  function mockTime(hour: number) {
    const mockDate = new realDate(2026, 3, 2, hour, 0, 0);
    jest.spyOn(global, "Date").mockImplementation(
      (...args: any[]) => (args.length ? new realDate(...(args as [any])) : mockDate) as Date
    );
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("calculates correct fare for a standard daytime ride", () => {
    mockTime(14); // 2 PM — daytime
    const result = calculateFare(10000, 900, "standard", basePricingRule);

    expect(result.base_fare).toBe(5.0);
    expect(result.distance_charge).toBe(12.0); // 1.2 * 10
    expect(result.time_charge).toBe(4.5); // 0.3 * 15
    expect(result.vehicle_multiplier).toBe(1.0);
    expect(result.estimated_fare).toBe(21.5); // 5 + 12 + 4.5
    expect(result.minimum_fare_applied).toBe(false);
    expect(result.is_fixed_route).toBe(false);
  });

  test("applies vehicle_type_multiplier for monovolume", () => {
    mockTime(14); // 2 PM — daytime
    const result = calculateFare(10000, 900, "monovolume", basePricingRule);

    // (5 + 12 + 4.5) * 1.3 = 27.95
    expect(result.vehicle_multiplier).toBe(1.3);
    expect(result.estimated_fare).toBe(27.95);
  });

  test("enforces minimum_fare when calculated fare is lower", () => {
    mockTime(14); // 2 PM — daytime
    const result = calculateFare(500, 60, "standard", basePricingRule);

    // base: 5, distance: 0.6, time: 0.3 = 5.9 < 8 minimum
    expect(result.estimated_fare).toBe(8.0);
    expect(result.minimum_fare_applied).toBe(true);
  });

  test("applies night surcharge between 22:00-06:00", () => {
    mockTime(23); // 11 PM — night
    const result = calculateFare(10000, 900, "standard", basePricingRule);

    // subtotal: 21.5, night: 21.5 * 0.2 = 4.3, total: 25.8
    expect(result.night_surcharge).toBe(4.3);
    expect(result.estimated_fare).toBe(25.8);
  });
});

describe("getActivePricingRule", () => {
  test("returns the default pricing rule", async () => {
    await createTestPricingRule(db);
    const rule = await getActivePricingRule();
    expect(rule).toBeDefined();
    expect(rule.base_fare).toBeDefined();
  });
});

describe("buildPricingSnapshot", () => {
  test("serializes pricing rule into snapshot", async () => {
    const rule = await createTestPricingRule(db);
    const snapshot = buildPricingSnapshot(rule as unknown as PricingRuleRow);
    expect(snapshot.rule_id).toBe(rule.id);
    expect(snapshot.base_fare).toBe(5.0);
    expect(snapshot.captured_at).toBeDefined();
  });
});

describe("checkFixedRoute", () => {
  test("returns null when no zones match", async () => {
    const result = await checkFixedRoute(0, 0, 1, 1);
    expect(result).toBeNull();
  });

  test("finds fixed route when pickup and dropoff are in matching zones", async () => {
    // Create two zones with polygons
    const [zone1] = await db("zones")
      .insert({
        name: "Zone A",
        city: "CityA",
        polygon: db.raw(
          "ST_GeomFromText('POLYGON((13.54 43.40, 13.56 43.40, 13.56 43.41, 13.54 43.41, 13.54 43.40))', 4326)"
        ),
        active: true,
      })
      .returning("*");

    const [zone2] = await db("zones")
      .insert({
        name: "Zone B",
        city: "CityB",
        polygon: db.raw(
          "ST_GeomFromText('POLYGON((13.50 43.38, 13.52 43.38, 13.52 43.39, 13.50 43.39, 13.50 43.38))', 4326)"
        ),
        active: true,
      })
      .returning("*");

    await db("fixed_routes").insert({
      name: "A to B",
      origin_zone_id: zone1.id,
      destination_zone_id: zone2.id,
      min_price: 25.0,
      max_price: 35.0,
    });

    // Point inside Zone A → Point inside Zone B
    const result = await checkFixedRoute(43.405, 13.55, 43.385, 13.51);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("A to B");
    expect(Number(result!.min_price)).toBe(25.0);
  });
});
