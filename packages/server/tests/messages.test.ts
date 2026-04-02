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

async function createRideWithDriver() {
  const customer = await createTestUser(db, { role: "customer" });
  const driverUser = await createTestUser(db, { role: "driver" });
  const driver = await createTestDriver(db, driverUser.id);
  await createTestPricingRule(db);

  const customerToken = makeToken(customer.id, "customer");
  const driverToken = makeToken(driverUser.id, "driver");

  // Create and accept a ride
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

  await request(app)
    .patch(`/api/rides/${rideId}/status`)
    .set("Authorization", `Bearer ${driverToken}`)
    .send({ status: "accepted" });

  return { rideId, customer, driverUser, customerToken, driverToken };
}

describe("POST /api/messages/:rideId (send message)", () => {
  test("customer can send a message", async () => {
    const { rideId, customerToken } = await createRideWithDriver();

    const res = await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Sono al bar centrale" });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe("Sono al bar centrale");
    expect(res.body.message_type).toBe("text");
    expect(res.body.ride_id).toBe(rideId);
  });

  test("driver can send a message", async () => {
    const { rideId, driverToken } = await createRideWithDriver();

    const res = await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ body: "Arrivo in 5 minuti" });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe("Arrivo in 5 minuti");
  });

  test("rejects empty message", async () => {
    const { rideId, customerToken } = await createRideWithDriver();

    const res = await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "" });

    expect(res.status).toBe(400);
  });

  test("non-participant cannot send message", async () => {
    const { rideId } = await createRideWithDriver();
    const outsider = await createTestUser(db, { role: "customer" });
    const outsiderToken = makeToken(outsider.id, "customer");

    const res = await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ body: "Hello" });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/messages/:rideId (list messages)", () => {
  test("returns messages in chronological order", async () => {
    const { rideId, customerToken, driverToken } = await createRideWithDriver();

    await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Message 1" });

    await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ body: "Message 2" });

    const res = await request(app)
      .get(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].body).toBe("Message 1");
    expect(res.body[1].body).toBe("Message 2");
    expect(res.body[0].sender_name).toBeDefined();
  });
});

describe("PATCH /api/messages/:messageId/read (mark as read)", () => {
  test("recipient can mark message as read", async () => {
    const { rideId, customerToken, driverToken } = await createRideWithDriver();

    // Customer sends message
    const sendRes = await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Ciao" });

    // Driver marks as read
    const res = await request(app)
      .patch(`/api/messages/${sendRes.body.id}/read`)
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.read_at).toBeDefined();
  });

  test("sender cannot mark own message as read", async () => {
    const { rideId, customerToken } = await createRideWithDriver();

    const sendRes = await request(app)
      .post(`/api/messages/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ body: "Ciao" });

    const res = await request(app)
      .patch(`/api/messages/${sendRes.body.id}/read`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(400);
  });
});
