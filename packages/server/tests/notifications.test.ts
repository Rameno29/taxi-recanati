import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";

const db: Knex = knexLib(knexConfig.test);

jest.mock("../src/db", () => ({
  __esModule: true,
  default: db,
}));

import request from "supertest";
import { app } from "../src/index";
import { createTestUser, cleanTables } from "./helpers";
import jwt from "jsonwebtoken";

function authToken(userId: string) {
  return jwt.sign({ userId, role: "customer" }, process.env.JWT_SECRET || "change-me-in-production");
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

describe("POST /api/notifications/register", () => {
  test("registers a push token successfully", async () => {
    const user = await createTestUser(db, { password: "test123" });
    const token = authToken(user.id);

    const res = await request(app)
      .post("/api/notifications/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: "ExponentPushToken[abc123]", platform: "android" });

    expect(res.status).toBe(200);

    const tokens = await db("push_tokens").where({ user_id: user.id });
    expect(tokens.length).toBe(1);
    expect(tokens[0].token).toBe("ExponentPushToken[abc123]");
  });

  test("rejects without a token field", async () => {
    const user = await createTestUser(db, { password: "test123" });
    const token = authToken(user.id);

    const res = await request(app)
      .post("/api/notifications/register")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/notifications/register")
      .send({ token: "ExponentPushToken[abc123]", platform: "android" });

    expect(res.status).toBe(401);
  });

  test("does not duplicate tokens for same user", async () => {
    const user = await createTestUser(db, { password: "test123" });
    const token = authToken(user.id);
    const pushToken = "ExponentPushToken[abc123]";

    await request(app)
      .post("/api/notifications/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: pushToken, platform: "android" });

    await request(app)
      .post("/api/notifications/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: pushToken, platform: "android" });

    const tokens = await db("push_tokens").where({ user_id: user.id });
    expect(tokens.length).toBe(1);
  });
});

describe("POST /api/notifications/unregister", () => {
  test("removes a push token", async () => {
    const user = await createTestUser(db, { password: "test123" });
    const token = authToken(user.id);
    const pushToken = "ExponentPushToken[abc123]";

    // Register first
    await request(app)
      .post("/api/notifications/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: pushToken, platform: "android" });

    // Then unregister
    const res = await request(app)
      .post("/api/notifications/unregister")
      .set("Authorization", `Bearer ${token}`)
      .send({ token: pushToken });

    expect(res.status).toBe(200);

    const tokens = await db("push_tokens").where({ user_id: user.id });
    expect(tokens.length).toBe(0);
  });
});
