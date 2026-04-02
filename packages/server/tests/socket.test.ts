import knexLib, { Knex } from "knex";
import knexConfig from "../knexfile";

const db: Knex = knexLib(knexConfig.test);

jest.mock("../src/db", () => ({
  __esModule: true,
  default: db,
}));

import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { config } from "../src/config";
import { createTestUser, createTestDriver, cleanTables } from "./helpers";
import { initializeSocket } from "../src/socket";
import { registerLocationHandler } from "../src/handlers/location.handler";
import { registerChatHandler } from "../src/handlers/chat.handler";

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let port: number;

function makeToken(userId: string, role: string) {
  return jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: "15m" } as jwt.SignOptions);
}

function connectClient(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
    });
    client.on("connect", () => resolve(client));
    client.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("Connection timeout")), 5000);
  });
}

beforeAll(async () => {
  await db.migrate.latest();

  const app = express();
  httpServer = createServer(app);
  io = initializeSocket(httpServer);
  registerLocationHandler(io);
  registerChatHandler(io);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      port = (httpServer.address() as any).port;
      resolve();
    });
  });
});

afterAll(async () => {
  io.close();
  httpServer.close();
  await db.migrate.rollback(undefined, true);
  await db.destroy();
});

beforeEach(async () => {
  await cleanTables(db)();
});

describe("Socket.io authentication", () => {
  test("rejects connection without token", async () => {
    await expect(connectClient("")).rejects.toThrow();
  });

  test("rejects connection with invalid token", async () => {
    await expect(connectClient("bad-token")).rejects.toThrow();
  });

  test("accepts connection with valid token", async () => {
    const user = await createTestUser(db, { role: "customer" });
    const token = makeToken(user.id, "customer");
    const client = await connectClient(token);
    expect(client.connected).toBe(true);
    client.disconnect();
  });
});

describe("GPS location broadcasting", () => {
  test("driver location update is broadcast to admin", async () => {
    const adminUser = await createTestUser(db, { role: "admin" });
    const driverUser = await createTestUser(db, { role: "driver" });
    await createTestDriver(db, driverUser.id, {
      currentLat: 43.40,
      currentLng: 13.55,
      status: "available",
    });

    const adminToken = makeToken(adminUser.id, "admin");
    const driverToken = makeToken(driverUser.id, "driver");

    const adminClient = await connectClient(adminToken);
    const driverClient = await connectClient(driverToken);

    // Wait for room joins to complete
    await new Promise((r) => setTimeout(r, 200));

    const locationPromise = new Promise<any>((resolve) => {
      adminClient.on("driver:location", (data) => resolve(data));
    });

    driverClient.emit("driver:location", {
      lat: 43.41,
      lng: 13.56,
      heading: 180,
      speed: 30,
    });

    const location = await locationPromise;
    expect(location.lat).toBe(43.41);
    expect(location.lng).toBe(13.56);
    expect(location.heading).toBe(180);

    adminClient.disconnect();
    driverClient.disconnect();
  });
});

describe("Chat messaging", () => {
  test("chat message is broadcast to ride room", async () => {
    const customer = await createTestUser(db, { role: "customer" });
    const driverUser = await createTestUser(db, { role: "driver" });
    const driver = await createTestDriver(db, driverUser.id);

    // Create a ride with this driver assigned
    const pricingRule = await db("pricing_rules").first() ||
      await db("pricing_rules").insert({
        base_fare: 5, per_km: 1.2, per_minute: 0.3,
        night_surcharge_pct: 20, minimum_fare: 8,
        cancellation_fee: 5, reservation_fee: 3,
      }).returning("*").then(r => r[0]);

    const [ride] = await db("rides")
      .insert({
        customer_id: customer.id,
        driver_id: driver.id,
        pickup_lat: 43.40, pickup_lng: 13.55,
        pickup_address: "Via Roma", destination_address: "Piazza Leopardi",
        destination_lat: 43.41, destination_lng: 13.56,
        type: "immediate", status: "accepted",
        dispatch_mode: "auto", fare_estimate: 15,
        pricing_snapshot_json: JSON.stringify({ rule_id: pricingRule.id }),
        requested_at: new Date(),
      })
      .returning("*");

    const customerToken = makeToken(customer.id, "customer");
    const driverToken = makeToken(driverUser.id, "driver");

    const customerClient = await connectClient(customerToken);
    const driverClient = await connectClient(driverToken);

    // Wait for room joins
    await new Promise((r) => setTimeout(r, 300));

    // Customer should join ride room automatically
    const messagePromise = new Promise<any>((resolve) => {
      driverClient.on("chat:message", (data) => resolve(data));
    });

    customerClient.emit("chat:message", {
      ride_id: ride.id,
      body: "Dove sei?",
    });

    const msg = await messagePromise;
    expect(msg.body).toBe("Dove sei?");
    expect(msg.ride_id).toBe(ride.id);

    // Verify message was saved to DB
    const messages = await db("messages").where("ride_id", ride.id);
    expect(messages).toHaveLength(1);

    customerClient.disconnect();
    driverClient.disconnect();
  });
});
