import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";

const db: Knex = knexLib(knexConfig.test);

jest.mock("../src/db", () => ({
  __esModule: true,
  default: db,
}));

import request from "supertest";
import { app } from "../src/index";
import { createTestUser, createTestDriver, createTestPricingRule, cleanTables } from "./helpers";
import jwt from "jsonwebtoken";
import { config } from "../src/config";

function makeToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: "15m" } as jwt.SignOptions);
}

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

describe("POST /api/rides (create ride)", () => {
  test("creates a ride with estimated fare and pending status", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    await createTestPricingRule(db);
    const token = makeToken(customer.id, "customer");

    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        type: "immediate",
        vehicle_type: "standard",
      });

    expect(res.status).toBe(201);
    expect(res.body.ride.status).toBe("pending");
    expect(res.body.ride.fare_estimate).toBeDefined();
    expect(res.body.ride.customer_id).toBe(customer.id);
    expect(res.body.fareBreakdown).toBeDefined();
  });

  test("stores pricing snapshot in ride", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    await createTestPricingRule(db);
    const token = makeToken(customer.id, "customer");

    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        type: "immediate",
        vehicle_type: "standard",
      });

    expect(res.status).toBe(201);
    const snapshot = typeof res.body.ride.pricing_snapshot_json === "string"
      ? JSON.parse(res.body.ride.pricing_snapshot_json)
      : res.body.ride.pricing_snapshot_json;
    expect(snapshot.base_fare).toBeDefined();
    expect(snapshot.per_km).toBeDefined();
    expect(snapshot.captured_at).toBeDefined();
  });

  test("rejects non-customer role", async () => {
    const driver = await createTestUser(db, { role: "driver" });
    await createTestPricingRule(db);
    const token = makeToken(driver.id, "driver");

    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        type: "immediate",
        vehicle_type: "standard",
      });

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/rides/:id/status (state machine)", () => {
  async function createPendingRide() {
    const customer = await createTestUser(db, { role: "customer" });
    await createTestPricingRule(db);
    const token = makeToken(customer.id, "customer");

    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send({
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        type: "immediate",
        vehicle_type: "standard",
      });

    return { ride: res.body.ride, customer, customerToken: token };
  }

  test("accepts ride: pending → accepted", async () => {
    const { ride } = await createPendingRide();
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id);
    const driverToken = makeToken(driverUser.id, "driver");

    const res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "accepted" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
    expect(res.body.driver_id).toBeDefined();
    expect(res.body.accepted_at).toBeDefined();
  });

  test("rejects invalid transition: pending → in_progress", async () => {
    const { ride } = await createPendingRide();
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id);
    const driverToken = makeToken(driverUser.id, "driver");

    const res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "in_progress" });

    expect(res.status).toBe(400);
  });

  test("full happy path: pending → accepted → arriving → in_progress → completed", async () => {
    const { ride } = await createPendingRide();
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id);
    const driverToken = makeToken(driverUser.id, "driver");

    // Accept
    let res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "accepted" });
    expect(res.body.status).toBe("accepted");

    // Arriving
    res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "arriving" });
    expect(res.body.status).toBe("arriving");

    // In progress
    res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "in_progress" });
    expect(res.body.status).toBe("in_progress");

    // Completed
    res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "completed" });
    expect(res.body.status).toBe("completed");
    expect(res.body.fare_final).toBeDefined();
    expect(res.body.completed_at).toBeDefined();
  });

  test("cancellation requires reason", async () => {
    const { ride, customerToken } = await createPendingRide();

    const res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "cancelled" });

    expect(res.status).toBe(400);
  });

  test("customer can cancel pending ride", async () => {
    const { ride, customerToken } = await createPendingRide();

    const res = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "cancelled", cancellation_reason: "Changed my mind" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.cancellation_reason).toBe("Changed my mind");
  });

  test("concurrent acceptance returns 409 for second driver", async () => {
    const { ride } = await createPendingRide();

    const driver1User = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driver1User.id);
    const driver1Token = makeToken(driver1User.id, "driver");

    const driver2User = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driver2User.id);
    const driver2Token = makeToken(driver2User.id, "driver");

    // First accept succeeds
    const res1 = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driver1Token}`)
      .send({ status: "accepted" });
    expect(res1.status).toBe(200);

    // Second accept fails (ride is no longer pending)
    const res2 = await request(app)
      .patch(`/api/rides/${ride.id}/status`)
      .set("Authorization", `Bearer ${driver2Token}`)
      .send({ status: "accepted" });
    expect(res2.status).toBe(400);
  });
});

describe("POST /api/rides/:id/rate", () => {
  test("rates a completed ride", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id);
    await createTestPricingRule(db);

    const customerToken = makeToken(customer.id, "customer");
    const driverToken = makeToken(driverUser.id, "driver");

    // Create ride
    const createRes = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup_lat: 43.4034, pickup_lng: 13.5498,
        destination_lat: 43.4134, destination_lng: 13.5598,
        type: "immediate", vehicle_type: "standard",
      });
    const rideId = createRes.body.ride.id;

    // Move to completed
    for (const status of ["accepted", "arriving", "in_progress", "completed"]) {
      await request(app)
        .patch(`/api/rides/${rideId}/status`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ status });
    }

    // Rate
    const res = await request(app)
      .post(`/api/rides/${rideId}/rate`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ customer_rating: 5, customer_feedback_text: "Ottimo!" });

    expect(res.status).toBe(200);
    expect(res.body.customer_rating).toBe(5);
    expect(res.body.customer_feedback_text).toBe("Ottimo!");
  });

  test("rejects rating a non-completed ride", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    await createTestPricingRule(db);
    const customerToken = makeToken(customer.id, "customer");

    const createRes = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup_lat: 43.4034, pickup_lng: 13.5498,
        destination_lat: 43.4134, destination_lng: 13.5598,
        type: "immediate", vehicle_type: "standard",
      });

    const res = await request(app)
      .post(`/api/rides/${createRes.body.ride.id}/rate`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ customer_rating: 4 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/rides/history", () => {
  test("returns paginated ride history", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    await createTestPricingRule(db);
    const customerToken = makeToken(customer.id, "customer");
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id);
    const driverToken = makeToken(driverUser.id, "driver");

    // Create and complete a ride
    const createRes = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup_lat: 43.4034, pickup_lng: 13.5498,
        destination_lat: 43.4134, destination_lng: 13.5598,
        type: "immediate", vehicle_type: "standard",
      });

    for (const status of ["accepted", "arriving", "in_progress", "completed"]) {
      await request(app)
        .patch(`/api/rides/${createRes.body.ride.id}/status`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ status });
    }

    const res = await request(app)
      .get("/api/rides/history")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rides).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
  });
});
