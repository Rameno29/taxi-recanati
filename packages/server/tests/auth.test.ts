import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";

// Create test DB connection before mocking
const db: Knex = knexLib(knexConfig.test);

// Mock must be at top level — Jest hoists it above imports
jest.mock("../src/db", () => ({
  __esModule: true,
  default: db,
}));

import request from "supertest";
import { app } from "../src/index";
import { createTestUser, cleanTables } from "./helpers";

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

describe("POST /api/auth/register", () => {
  test("registers a new customer", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        phone: "+393271234567",
        name: "Mario Rossi",
        email: "mario@example.com",
        password: "securepass123",
        language: "it",
      });

    expect(res.status).toBe(201);
    expect(res.body.user.name).toBe("Mario Rossi");
    expect(res.body.user.phone).toBe("+393271234567");
    expect(res.body.user.role).toBe("customer");
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test("rejects duplicate phone", async () => {
    await createTestUser(db, { phone: "+393271234567" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        phone: "+393271234567",
        name: "Duplicate User",
      });

    expect(res.status).toBe(409);
  });

  test("rejects invalid phone format", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        phone: "not-a-phone",
        name: "Bad Phone",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});

describe("POST /api/auth/login/email", () => {
  test("logs in with correct email and password", async () => {
    await createTestUser(db, {
      email: "mario@example.com",
      password: "securepass123",
    });

    const res = await request(app)
      .post("/api/auth/login/email")
      .send({
        email: "mario@example.com",
        password: "securepass123",
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe("mario@example.com");
  });

  test("rejects wrong password", async () => {
    await createTestUser(db, {
      email: "mario@example.com",
      password: "securepass123",
    });

    const res = await request(app)
      .post("/api/auth/login/email")
      .send({
        email: "mario@example.com",
        password: "wrongpassword",
      });

    expect(res.status).toBe(401);
  });

  test("rejects non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login/email")
      .send({
        email: "noone@example.com",
        password: "whatever123",
      });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  test("issues new tokens with valid refresh token", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({
        phone: "+393279999999",
        name: "Refresh User",
      });

    const { refreshToken } = registerRes.body;

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  test("rejects invalid refresh token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "bad-token" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  test("returns user profile with valid token", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({
        phone: "+393270000001",
        name: "Me User",
        language: "en",
      });

    const { accessToken } = registerRes.body;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Me User");
    expect(res.body.language).toBe("en");
  });

  test("rejects request without token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});
