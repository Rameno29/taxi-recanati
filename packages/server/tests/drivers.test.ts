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

describe("PATCH /api/drivers/status", () => {
  test("driver can set status to available", async () => {
    const user = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, user.id, { status: "offline" });
    const token = makeToken(user.id, "driver");

    const res = await request(app)
      .patch("/api/drivers/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "available" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("available");
  });

  test("driver can set status to paused", async () => {
    const user = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, user.id, { status: "available" });
    const token = makeToken(user.id, "driver");

    const res = await request(app)
      .patch("/api/drivers/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "paused" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paused");
  });

  test("cannot go offline while busy on a ride", async () => {
    const user = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, user.id, { status: "busy" });
    const token = makeToken(user.id, "driver");

    const res = await request(app)
      .patch("/api/drivers/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "offline" });

    expect(res.status).toBe(409);
  });

  test("non-driver role is rejected", async () => {
    const user = await createTestUser(db, { role: "customer" });
    const token = makeToken(user.id, "customer");

    const res = await request(app)
      .patch("/api/drivers/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "available" });

    expect(res.status).toBe(403);
  });

  test("rejects invalid status value", async () => {
    const user = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, user.id);
    const token = makeToken(user.id, "driver");

    const res = await request(app)
      .patch("/api/drivers/status")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "busy" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/drivers/location", () => {
  test("driver can push GPS location", async () => {
    const user = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, user.id);
    const token = makeToken(user.id, "driver");

    const res = await request(app)
      .post("/api/drivers/location")
      .set("Authorization", `Bearer ${token}`)
      .send({ lat: 43.405, lng: 13.551, heading: 90, speed: 45 });

    expect(res.status).toBe(200);
    expect(res.body.driver_id).toBeDefined();

    // Verify driver position was updated
    const driver = await db("drivers").where("user_id", user.id).first();
    expect(Number(driver.current_lat)).toBeCloseTo(43.405, 3);
    expect(Number(driver.current_lng)).toBeCloseTo(13.551, 3);

    // Verify location history was saved
    const locations = await db("driver_locations").where("driver_id", driver.id);
    expect(locations).toHaveLength(1);
    expect(Number(locations[0].heading)).toBe(90);
  });
});

describe("GET /api/drivers/earnings", () => {
  test("returns earnings summary", async () => {
    const user = await createTestUser(db, { role: "driver" });
    const driver = await createTestDriver(db, user.id);
    const token = makeToken(user.id, "driver");

    // No completed rides yet
    const res = await request(app)
      .get("/api/drivers/earnings")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total_rides).toBe(0);
    expect(res.body.total_earnings).toBe(0);
    expect(res.body.driver_id).toBe(driver.id);
  });

  test("calculates earnings from completed rides", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    const driverUser = await createTestUser(db, { role: "driver" });
    const driver = await createTestDriver(db, driverUser.id);
    await createTestPricingRule(db);
    const driverToken = makeToken(driverUser.id, "driver");
    const customerToken = makeToken(customer.id, "customer");

    // Create and complete a ride
    const createRes = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        pickup_lat: 43.4034,
        pickup_lng: 13.5498,
        destination_lat: 43.4134,
        destination_lng: 13.5598,
        type: "immediate",
        vehicle_type: "standard",
      });

    const rideId = createRes.body.ride.id;
    for (const status of ["accepted", "arriving", "in_progress", "completed"]) {
      await request(app)
        .patch(`/api/rides/${rideId}/status`)
        .set("Authorization", `Bearer ${driverToken}`)
        .send({ status });
    }

    const res = await request(app)
      .get("/api/drivers/earnings")
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total_rides).toBe(1);
    expect(res.body.total_earnings).toBeGreaterThan(0);
  });
});
