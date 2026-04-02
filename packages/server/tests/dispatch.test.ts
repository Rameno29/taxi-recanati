import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";

const db: Knex = knexLib(knexConfig.test);

jest.mock("../src/db", () => ({
  __esModule: true,
  default: db,
}));

import { findNearestDrivers, manualDispatch, runAutoDispatch } from "../src/services/dispatch.service";
import { createTestUser, createTestDriver, createTestPricingRule, cleanTables } from "./helpers";

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

describe("findNearestDrivers", () => {
  test("returns drivers ordered by distance", async () => {
    const user1 = await createTestUser(db, { role: "driver" });
    const user2 = await createTestUser(db, { role: "driver" });

    // Driver 1: close to pickup
    await createTestDriver(db, user1.id, {
      currentLat: 43.404,
      currentLng: 13.550,
      status: "available",
    });

    // Driver 2: farther away
    await createTestDriver(db, user2.id, {
      currentLat: 43.420,
      currentLng: 13.570,
      status: "available",
    });

    const drivers = await findNearestDrivers(43.403, 13.549);

    expect(drivers.length).toBe(2);
    expect(Number(drivers[0].distance_meters)).toBeLessThan(Number(drivers[1].distance_meters));
  });

  test("excludes offline/paused drivers", async () => {
    const user1 = await createTestUser(db, { role: "driver" });
    const user2 = await createTestUser(db, { role: "driver" });

    await createTestDriver(db, user1.id, {
      currentLat: 43.404,
      currentLng: 13.550,
      status: "available",
    });

    await createTestDriver(db, user2.id, {
      currentLat: 43.404,
      currentLng: 13.551,
      status: "offline",
    });

    const drivers = await findNearestDrivers(43.403, 13.549);
    expect(drivers.length).toBe(1);
  });

  test("excludes drivers with stale location (>60s)", async () => {
    const user = await createTestUser(db, { role: "driver" });

    const driver = await createTestDriver(db, user.id, {
      currentLat: 43.404,
      currentLng: 13.550,
      status: "available",
    });

    // Make location stale
    await db("drivers")
      .where("id", driver.id)
      .update({ last_location_at: new Date(Date.now() - 120000) });

    const drivers = await findNearestDrivers(43.403, 13.549);
    expect(drivers.length).toBe(0);
  });
});

describe("manualDispatch", () => {
  test("assigns ride and logs admin action", async () => {
    const admin = await createTestUser(db, { role: "admin" });
    const customer = await createTestUser(db, { role: "customer" });
    const driverUser = await createTestUser(db, { role: "driver" });
    const driver = await createTestDriver(db, driverUser.id);
    await createTestPricingRule(db);

    // Create a pending ride directly
    const pricingRule = await db("pricing_rules").first();
    const [ride] = await db("rides")
      .insert({
        customer_id: customer.id,
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        pickup_address: "",
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        destination_address: "",
        type: "immediate",
        vehicle_type: "standard",
        status: "pending",
        dispatch_mode: "auto",
        fare_estimate: 15.0,
        pricing_snapshot_json: JSON.stringify({ rule_id: pricingRule.id }),
        requested_at: new Date(),
      })
      .returning("*");

    const result = await manualDispatch(ride.id, driver.id, admin.id);

    expect(result.status).toBe("accepted");
    expect(result.driver_id).toBe(driver.id);
    expect(result.dispatch_mode).toBe("manual");

    // Check admin action was logged
    const actions = await db("admin_actions")
      .where("admin_user_id", admin.id)
      .where("entity_id", ride.id);
    expect(actions.length).toBe(1);
    expect(actions[0].action_type).toBe("dispatch_override");

    // Check ride_status_history
    const history = await db("ride_status_history").where("ride_id", ride.id);
    expect(history.length).toBe(1);
    expect(history[0].old_status).toBe("pending");
    expect(history[0].new_status).toBe("accepted");

    // Check driver is now on_ride
    const updatedDriver = await db("drivers").where("id", driver.id).first();
    expect(updatedDriver.status).toBe("busy");
  });

  test("rejects dispatch on non-pending ride", async () => {
    const admin = await createTestUser(db, { role: "admin" });
    const customer = await createTestUser(db, { role: "customer" });
    const driverUser = await createTestUser(db, { role: "driver" });
    const driver = await createTestDriver(db, driverUser.id);
    await createTestPricingRule(db);

    const pricingRule = await db("pricing_rules").first();
    const [ride] = await db("rides")
      .insert({
        customer_id: customer.id,
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        pickup_address: "",
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        destination_address: "",
        type: "immediate",
        vehicle_type: "standard",
        status: "accepted",
        dispatch_mode: "auto",
        fare_estimate: 15.0,
        pricing_snapshot_json: JSON.stringify({ rule_id: pricingRule.id }),
        requested_at: new Date(),
      })
      .returning("*");

    await expect(manualDispatch(ride.id, driver.id, admin.id)).rejects.toThrow(
      "Cannot dispatch ride"
    );
  });
});

describe("runAutoDispatch", () => {
  test("creates dispatch attempt for nearest driver", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id, {
      currentLat: 43.404,
      currentLng: 13.550,
      status: "available",
    });
    await createTestPricingRule(db);

    const pricingRule = await db("pricing_rules").first();
    const [ride] = await db("rides")
      .insert({
        customer_id: customer.id,
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        pickup_address: "",
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        destination_address: "",
        type: "immediate",
        vehicle_type: "standard",
        status: "pending",
        dispatch_mode: "auto",
        fare_estimate: 15.0,
        pricing_snapshot_json: JSON.stringify({ rule_id: pricingRule.id }),
        requested_at: new Date(),
      })
      .returning("*");

    const result = await runAutoDispatch(ride.id);

    expect(result).not.toBeNull();
    expect(result!.attempt.ride_id).toBe(ride.id);
    expect(result!.attempt.attempt_no).toBe(1);
    expect(result!.attempt.triggered_by).toBe("system");

    // Verify attempt was saved
    const attempts = await db("ride_dispatch_attempts").where("ride_id", ride.id);
    expect(attempts.length).toBe(1);
  });
});
