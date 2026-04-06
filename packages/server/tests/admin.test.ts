import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";

const db: Knex = knexLib(knexConfig.test);

jest.mock("../src/db", () => ({
  __esModule: true,
  default: db,
}));

import request from "supertest";
import { app } from "../src/index";
import { createTestUser, createTestDriver, cleanTables } from "./helpers";
import jwt from "jsonwebtoken";

function authToken(userId: string, role: string = "admin") {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || "change-me-in-production");
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

describe("GET /api/admin/stats", () => {
  test("returns stats for admin user", async () => {
    const admin = await createTestUser(db, { role: "admin", password: "admin123" });
    const token = authToken(admin.id, "admin");

    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("rides");
    expect(res.body).toHaveProperty("drivers");
    expect(res.body.rides).toHaveProperty("pending");
    expect(res.body.rides).toHaveProperty("active");
    expect(res.body.drivers).toHaveProperty("total");
  });

  test("rejects non-admin users with 403", async () => {
    const customer = await createTestUser(db, { role: "customer", password: "test123" });
    const token = authToken(customer.id, "customer");

    const res = await request(app)
      .get("/api/admin/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/admin/stats");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/rides", () => {
  test("returns rides list for admin", async () => {
    const admin = await createTestUser(db, { role: "admin", password: "admin123" });
    const token = authToken(admin.id, "admin");

    const res = await request(app)
      .get("/api/admin/rides")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("rides");
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.rides)).toBe(true);
  });

  test("rejects non-admin users", async () => {
    const customer = await createTestUser(db, { role: "customer", password: "test123" });
    const token = authToken(customer.id, "customer");

    const res = await request(app)
      .get("/api/admin/rides")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/drivers", () => {
  test("returns drivers list for admin", async () => {
    const admin = await createTestUser(db, { role: "admin", password: "admin123" });
    const driverUser = await createTestUser(db, { role: "driver", name: "Marco Rossi" });
    await createTestDriver(db, driverUser.id, { status: "available" });
    const token = authToken(admin.id, "admin");

    const res = await request(app)
      .get("/api/admin/drivers")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test("filters by status", async () => {
    const admin = await createTestUser(db, { role: "admin", password: "admin123" });
    const driverUser1 = await createTestUser(db, { role: "driver", name: "Driver A" });
    const driverUser2 = await createTestUser(db, { role: "driver", name: "Driver B" });
    await createTestDriver(db, driverUser1.id, { status: "available" });
    await createTestDriver(db, driverUser2.id, { status: "offline" });
    const token = authToken(admin.id, "admin");

    const res = await request(app)
      .get("/api/admin/drivers?status=available")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.every((d: any) => d.status === "available")).toBe(true);
  });
});

describe("GET /api/admin/drivers/positions", () => {
  test("returns positions for online drivers", async () => {
    const admin = await createTestUser(db, { role: "admin", password: "admin123" });
    const driverUser = await createTestUser(db, { role: "driver", name: "GPS Driver" });
    await createTestDriver(db, driverUser.id, {
      status: "available",
      currentLat: 43.4034,
      currentLng: 13.5498,
    });
    const token = authToken(admin.id, "admin");

    const res = await request(app)
      .get("/api/admin/drivers/positions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
