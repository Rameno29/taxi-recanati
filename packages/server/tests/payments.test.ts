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
import { setStripeInstance } from "../src/services/payment.service";

function makeToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: "15m" } as jwt.SignOptions);
}

// Mock Stripe SDK
const mockStripe = {
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: "pi_test_123",
      client_secret: "pi_test_123_secret_abc",
      status: "requires_payment_method",
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: "pi_test_123",
      status: "requires_capture",
    }),
    capture: jest.fn().mockResolvedValue({
      id: "pi_test_123",
      status: "succeeded",
      amount_received: 1500,
    }),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({
      id: "re_test_123",
      amount: 1500,
    }),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
} as any;

beforeAll(async () => {
  await db.migrate.latest();
  setStripeInstance(mockStripe);
});

afterAll(async () => {
  setStripeInstance(null);
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

beforeEach(async () => {
  await cleanTables(db)();
  jest.clearAllMocks();
});

async function createRideForPayment() {
  const customer = await createTestUser(db, { role: "customer" });
  const driverUser = await createTestUser(db, { role: "driver" });
  await createTestDriver(db, driverUser.id);
  await createTestPricingRule(db);

  const customerToken = makeToken(customer.id, "customer");
  const driverToken = makeToken(driverUser.id, "driver");

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

  return {
    rideId: createRes.body.ride.id,
    customer,
    customerToken,
    driverUser,
    driverToken,
  };
}

describe("POST /api/payments/create-intent", () => {
  test("creates a payment intent for a ride", async () => {
    const { rideId, customerToken } = await createRideForPayment();

    const res = await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    expect(res.status).toBe(201);
    expect(res.body.stripe_payment_intent_id).toBe("pi_test_123");
    expect(res.body.client_secret).toBe("pi_test_123_secret_abc");
    expect(res.body.status).toBe("pending");
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "eur",
        capture_method: "manual",
      })
    );
  });

  test("returns existing payment if already created", async () => {
    const { rideId, customerToken } = await createRideForPayment();

    // Create first
    await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    // Create again — should return existing
    const res = await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    expect(res.status).toBe(201);
    // Stripe should only be called once
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  });

  test("non-owner cannot create payment", async () => {
    const { rideId } = await createRideForPayment();
    const other = await createTestUser(db, { role: "customer" });
    const otherToken = makeToken(other.id, "customer");

    const res = await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ rideId });

    expect(res.status).toBe(403);
  });
});

describe("POST /api/payments/:id/confirm", () => {
  test("confirms an authorized payment", async () => {
    const { rideId, customerToken } = await createRideForPayment();

    const createRes = await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    const res = await request(app)
      .post(`/api/payments/${createRes.body.id}/confirm`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("authorized");

    // Verify ride payment_status updated
    const ride = await db("rides").where("id", rideId).first();
    expect(ride.payment_status).toBe("authorized");
  });
});

describe("GET /api/payments/ride/:rideId", () => {
  test("returns payment for a ride", async () => {
    const { rideId, customerToken } = await createRideForPayment();

    await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    const res = await request(app)
      .get(`/api/payments/ride/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ride_id).toBe(rideId);
    expect(res.body.provider).toBe("stripe");
  });

  test("returns 404 when no payment exists", async () => {
    const { rideId, customerToken } = await createRideForPayment();

    const res = await request(app)
      .get(`/api/payments/ride/${rideId}`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/payments/refund", () => {
  test("admin can refund a captured payment", async () => {
    const { rideId, customerToken, driverToken } = await createRideForPayment();
    const admin = await createTestUser(db, { role: "admin" });
    const adminToken = makeToken(admin.id, "admin");

    // Create and authorize payment
    await request(app)
      .post("/api/payments/create-intent")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    // Simulate captured status (as if webhook/confirm happened)
    await db("payments")
      .where("ride_id", rideId)
      .update({
        status: "captured",
        captured_amount: 15.0,
        paid_at: new Date(),
      });

    const res = await request(app)
      .post("/api/payments/refund")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rideId });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("refunded");
    expect(mockStripe.refunds.create).toHaveBeenCalled();
  });

  test("non-admin cannot refund", async () => {
    const { rideId, customerToken } = await createRideForPayment();

    const res = await request(app)
      .post("/api/payments/refund")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rideId });

    expect(res.status).toBe(403);
  });
});
