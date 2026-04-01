# Plan 1: Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the monorepo, PostgreSQL + PostGIS database with all 14 tables, core data models, and a fully working auth API with JWT tokens, phone OTP, email/password, and social login.

**Architecture:** Turborepo monorepo with three packages — `server` (Express API), `customer-app` (Expo React Native), and `driver-app` (Expo React Native). This plan focuses on the `server` package only. Database migrations via Knex.js. Auth via JWT with refresh tokens. OTP via Twilio Verify.

**Tech Stack:** Node.js 20, TypeScript, Express, Knex.js (query builder + migrations), PostgreSQL 16 + PostGIS 3, JWT (jsonwebtoken), bcrypt, Twilio Verify, Zod (validation), Jest + Supertest (testing), Docker Compose (local DB)

---

## File Structure

```
taxi-recanati/
├── package.json                          # Turborepo root
├── turbo.json                            # Turborepo config
├── tsconfig.base.json                    # Shared TS config
├── docker-compose.yml                    # PostgreSQL + PostGIS local dev
├── .env.example                          # Environment variable template
├── .gitignore                            # Updated with node_modules, .env, dist
├── packages/
│   └── server/
│       ├── package.json
│       ├── tsconfig.json
│       ├── jest.config.ts
│       ├── knexfile.ts                   # Knex config (reads DATABASE_URL)
│       ├── src/
│       │   ├── index.ts                  # Express app entry + Socket.io bootstrap
│       │   ├── config.ts                 # Env var loader + validation
│       │   ├── db.ts                     # Knex instance singleton
│       │   ├── middleware/
│       │   │   ├── auth.ts               # JWT verification middleware
│       │   │   ├── requireRole.ts        # Role-based access guard
│       │   │   ├── errorHandler.ts       # Global error handler
│       │   │   └── rateLimiter.ts        # Per-user rate limiting
│       │   ├── routes/
│       │   │   └── auth.ts               # /api/auth/* routes
│       │   ├── services/
│       │   │   └── auth.service.ts       # Auth business logic
│       │   ├── validators/
│       │   │   └── auth.validators.ts    # Zod schemas for auth endpoints
│       │   └── types/
│       │       ├── db.ts                 # DB row types (all 14 tables)
│       │       └── api.ts               # Request/response types
│       ├── migrations/
│       │   ├── 001_enable_extensions.ts
│       │   ├── 002_create_users.ts
│       │   ├── 003_create_drivers.ts
│       │   ├── 004_create_zones.ts
│       │   ├── 005_create_fixed_routes.ts
│       │   ├── 006_create_pricing_rules.ts
│       │   ├── 007_create_rides.ts
│       │   ├── 008_create_ride_status_history.ts
│       │   ├── 009_create_ride_dispatch_attempts.ts
│       │   ├── 010_create_driver_locations.ts
│       │   ├── 011_create_messages.ts
│       │   ├── 012_create_payments.ts
│       │   ├── 013_create_push_tokens.ts
│       │   └── 014_create_admin_actions.ts
│       ├── seeds/
│       │   └── 001_dev_seed.ts           # Dev data: admin user, driver, pricing rule, zones
│       └── tests/
│           ├── setup.ts                  # Test DB setup/teardown
│           ├── helpers.ts                # Factory functions for test data
│           ├── migrations.test.ts        # Migration smoke test
│           ├── auth.test.ts              # Auth endpoint integration tests
│           └── middleware.test.ts         # Auth + role middleware unit tests
```

---

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore` (overwrite existing)
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "taxi-recanati",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
version: "3.9"
services:
  db:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: taxi
      POSTGRES_PASSWORD: taxi_dev_password
      POSTGRES_DB: taxi_recanati
    volumes:
      - pgdata:/var/lib/postgresql/data

  db-test:
    image: postgis/postgis:16-3.4
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: taxi
      POSTGRES_PASSWORD: taxi_test_password
      POSTGRES_DB: taxi_recanati_test
    tmpfs:
      - /var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 5: Create `.env.example`**

```env
# Database
DATABASE_URL=postgresql://taxi:taxi_dev_password@localhost:5432/taxi_recanati
DATABASE_URL_TEST=postgresql://taxi:taxi_test_password@localhost:5433/taxi_recanati_test

# JWT
JWT_SECRET=change-me-in-production
JWT_REFRESH_SECRET=change-me-refresh-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Twilio (OTP)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=

# Google Maps
GOOGLE_MAPS_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Server
PORT=3000
NODE_ENV=development
```

- [ ] **Step 6: Overwrite `.gitignore`**

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
.superpowers/
.turbo/
*.log
coverage/
```

- [ ] **Step 7: Create `packages/server/package.json`**

```json
{
  "name": "@taxi-recanati/server",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --forceExit --detectOpenHandles",
    "migrate": "knex migrate:latest --knexfile knexfile.ts",
    "migrate:rollback": "knex migrate:rollback --knexfile knexfile.ts",
    "seed": "knex seed:run --knexfile knexfile.ts"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.0",
    "express-rate-limit": "^7.5.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "knex": "^3.1.0",
    "pg": "^8.13.0",
    "socket.io": "^4.8.0",
    "twilio": "^5.4.0",
    "uuid": "^11.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 8: Create `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 9: Install dependencies**

Run: `cd /c/Users/stafi.000/Desktop/Taxi\ Recanati && npm install`
Expected: `node_modules/` created at root and packages linked

- [ ] **Step 10: Verify monorepo structure**

Run: `npx turbo --version`
Expected: Prints turbo version (2.x)

- [ ] **Step 11: Commit**

```bash
git add package.json turbo.json tsconfig.base.json docker-compose.yml .env.example .gitignore packages/server/package.json packages/server/tsconfig.json package-lock.json
git commit -m "feat: scaffold Turborepo monorepo with server package"
```

---

### Task 2: Database Config & Connection

**Files:**
- Create: `packages/server/knexfile.ts`
- Create: `packages/server/src/config.ts`
- Create: `packages/server/src/db.ts`

- [ ] **Step 1: Create `packages/server/src/config.ts`**

```typescript
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.NODE_ENV === "test"
      ? process.env.DATABASE_URL_TEST!
      : process.env.DATABASE_URL!,
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    verifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID || "",
  },
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  },
} as const;
```

- [ ] **Step 2: Create `packages/server/src/db.ts`**

```typescript
import knex from "knex";
import { config } from "./config";

const db = knex({
  client: "pg",
  connection: config.databaseUrl,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: "../migrations",
    extension: "ts",
  },
});

export default db;
```

- [ ] **Step 3: Create `packages/server/knexfile.ts`**

```typescript
import dotenv from "dotenv";
import path from "path";
import type { Knex } from "knex";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const baseConfig: Knex.Config = {
  client: "pg",
  pool: { min: 2, max: 10 },
  migrations: {
    directory: "./migrations",
    extension: "ts",
  },
  seeds: {
    directory: "./seeds",
    extension: "ts",
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
    connection: process.env.DATABASE_URL,
  },
  test: {
    ...baseConfig,
    connection: process.env.DATABASE_URL_TEST,
  },
  production: {
    ...baseConfig,
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 20 },
  },
};

export default config;
module.exports = config;
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/knexfile.ts packages/server/src/config.ts packages/server/src/db.ts
git commit -m "feat: add database config, Knex setup, and env loader"
```

---

### Task 3: Database Migrations — Extensions & Users

**Files:**
- Create: `packages/server/migrations/001_enable_extensions.ts`
- Create: `packages/server/migrations/002_create_users.ts`

- [ ] **Step 1: Create `packages/server/migrations/001_enable_extensions.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await knex.raw("CREATE EXTENSION IF NOT EXISTS postgis");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP EXTENSION IF EXISTS postgis CASCADE");
  await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE');
}
```

- [ ] **Step 2: Create `packages/server/migrations/002_create_users.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE user_role AS ENUM ('customer', 'driver', 'admin');
    CREATE TYPE user_language AS ENUM ('it', 'en');
  `);

  await knex.schema.createTable("users", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.specificType("role", "user_role").notNullable().defaultTo("customer");
    table.string("name").notNullable();
    table.string("email").unique();
    table.string("phone").unique().notNullable();
    table.string("password_hash");
    table.specificType("language", "user_language").notNullable().defaultTo("it");
    table.string("avatar");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("users");
  await knex.raw("DROP TYPE IF EXISTS user_language");
  await knex.raw("DROP TYPE IF EXISTS user_role");
}
```

- [ ] **Step 3: Start the dev database**

Run: `cd /c/Users/stafi.000/Desktop/Taxi\ Recanati && docker compose up -d db db-test`
Expected: Two PostgreSQL containers running on ports 5432 and 5433

- [ ] **Step 4: Create `.env` from example**

```bash
cp .env.example .env
```

The default values in `.env.example` match the docker-compose credentials, so no edits needed for local dev.

- [ ] **Step 5: Run migrations**

Run: `cd packages/server && npx knex migrate:latest --knexfile knexfile.ts`
Expected: `Batch 1 run: 2 migrations`

- [ ] **Step 6: Commit**

```bash
git add packages/server/migrations/001_enable_extensions.ts packages/server/migrations/002_create_users.ts
git commit -m "feat: add extensions and users table migration"
```

---

### Task 4: Database Migrations — Drivers, Zones, Fixed Routes, Pricing Rules

**Files:**
- Create: `packages/server/migrations/003_create_drivers.ts`
- Create: `packages/server/migrations/004_create_zones.ts`
- Create: `packages/server/migrations/005_create_fixed_routes.ts`
- Create: `packages/server/migrations/006_create_pricing_rules.ts`

- [ ] **Step 1: Create `packages/server/migrations/003_create_drivers.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE driver_status AS ENUM ('offline', 'available', 'busy', 'paused', 'suspended');
    CREATE TYPE vehicle_type AS ENUM ('standard', 'monovolume');
  `);

  await knex.schema.createTable("drivers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("license_plate").notNullable();
    table.specificType("vehicle_type", "vehicle_type").notNullable().defaultTo("standard");
    table.string("vehicle_model");
    table.string("vehicle_color");
    table.integer("max_capacity").notNullable().defaultTo(4);
    table.specificType("status", "driver_status").notNullable().defaultTo("offline");
    table.boolean("is_verified").notNullable().defaultTo(false);
    table.uuid("service_zone").references("id").inTable("zones").onDelete("SET NULL");
    table.decimal("current_lat", 10, 7);
    table.decimal("current_lng", 10, 7);
    table.timestamp("last_location_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("drivers");
  await knex.raw("DROP TYPE IF EXISTS vehicle_type");
  await knex.raw("DROP TYPE IF EXISTS driver_status");
}
```

Note: The `service_zone` FK references `zones`, which is created in the next migration. We must create zones first — reorder so zones migration runs before drivers.

**Correction:** Rename files so `004_create_zones.ts` becomes `003_create_zones.ts` and `003_create_drivers.ts` becomes `004_create_drivers.ts`. The actual content is the same. Here is the corrected ordering:

- [ ] **Step 1 (corrected): Create `packages/server/migrations/003_create_zones.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("zones", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("name").notNullable();
    table.string("city").notNullable();
    table.specificType("polygon", "geometry(Polygon, 4326)");
    table.boolean("active").notNullable().defaultTo(true);
  });

  await knex.raw("CREATE INDEX idx_zones_polygon ON zones USING GIST (polygon)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("zones");
}
```

- [ ] **Step 2: Create `packages/server/migrations/004_create_drivers.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE driver_status AS ENUM ('offline', 'available', 'busy', 'paused', 'suspended');
    CREATE TYPE vehicle_type AS ENUM ('standard', 'monovolume');
  `);

  await knex.schema.createTable("drivers", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("user_id").notNullable().unique().references("id").inTable("users").onDelete("CASCADE");
    table.string("license_plate").notNullable();
    table.specificType("vehicle_type", "vehicle_type").notNullable().defaultTo("standard");
    table.string("vehicle_model");
    table.string("vehicle_color");
    table.integer("max_capacity").notNullable().defaultTo(4);
    table.specificType("status", "driver_status").notNullable().defaultTo("offline");
    table.boolean("is_verified").notNullable().defaultTo(false);
    table.uuid("service_zone").references("id").inTable("zones").onDelete("SET NULL");
    table.decimal("current_lat", 10, 7);
    table.decimal("current_lng", 10, 7);
    table.timestamp("last_location_at", { useTz: true });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("drivers");
  await knex.raw("DROP TYPE IF EXISTS vehicle_type");
  await knex.raw("DROP TYPE IF EXISTS driver_status");
}
```

- [ ] **Step 3: Create `packages/server/migrations/005_create_fixed_routes.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("fixed_routes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.string("name").notNullable();
    table.uuid("origin_zone_id").notNullable().references("id").inTable("zones").onDelete("CASCADE");
    table.uuid("destination_zone_id").notNullable().references("id").inTable("zones").onDelete("CASCADE");
    table.decimal("min_price", 10, 2).notNullable();
    table.decimal("max_price", 10, 2).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("fixed_routes");
}
```

- [ ] **Step 4: Create `packages/server/migrations/006_create_pricing_rules.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("pricing_rules", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.decimal("base_fare", 10, 2).notNullable();
    table.decimal("per_km", 10, 2).notNullable();
    table.decimal("per_minute", 10, 2).notNullable();
    table.decimal("night_surcharge_pct", 5, 2).notNullable().defaultTo(0);
    table.decimal("minimum_fare", 10, 2).notNullable();
    table.decimal("cancellation_fee", 10, 2).notNullable().defaultTo(0);
    table.decimal("reservation_fee", 10, 2).notNullable().defaultTo(0);
    table.jsonb("vehicle_type_multiplier").notNullable().defaultTo('{"standard": 1.0, "monovolume": 1.3}');
    table.specificType("time_window", "tstzrange");
    table.uuid("updated_by").references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("pricing_rules");
}
```

- [ ] **Step 5: Run migrations**

Run: `cd packages/server && npx knex migrate:latest --knexfile knexfile.ts`
Expected: `Batch 2 run: 4 migrations`

- [ ] **Step 6: Commit**

```bash
git add packages/server/migrations/003_create_zones.ts packages/server/migrations/004_create_drivers.ts packages/server/migrations/005_create_fixed_routes.ts packages/server/migrations/006_create_pricing_rules.ts
git commit -m "feat: add zones, drivers, fixed_routes, pricing_rules migrations"
```

---

### Task 5: Database Migrations — Rides, Audit Tables, Locations

**Files:**
- Create: `packages/server/migrations/007_create_rides.ts`
- Create: `packages/server/migrations/008_create_ride_status_history.ts`
- Create: `packages/server/migrations/009_create_ride_dispatch_attempts.ts`
- Create: `packages/server/migrations/010_create_driver_locations.ts`

- [ ] **Step 1: Create `packages/server/migrations/007_create_rides.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE ride_type AS ENUM ('immediate', 'reservation', 'tour');
    CREATE TYPE ride_status AS ENUM ('pending', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled', 'expired', 'no_show');
    CREATE TYPE dispatch_mode AS ENUM ('auto', 'manual');
    CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed');
  `);

  await knex.schema.createTable("rides", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("customer_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.uuid("driver_id").references("id").inTable("drivers").onDelete("SET NULL");
    table.specificType("type", "ride_type").notNullable();
    table.specificType("status", "ride_status").notNullable().defaultTo("pending");
    table.specificType("dispatch_mode", "dispatch_mode").notNullable().defaultTo("auto");
    table.decimal("pickup_lat", 10, 7).notNullable();
    table.decimal("pickup_lng", 10, 7).notNullable();
    table.decimal("destination_lat", 10, 7).notNullable();
    table.decimal("destination_lng", 10, 7).notNullable();
    table.string("pickup_address").notNullable();
    table.string("destination_address").notNullable();
    table.timestamp("scheduled_at", { useTz: true });
    table.integer("distance_meters");
    table.integer("duration_seconds");
    table.decimal("fare_estimate", 10, 2);
    table.decimal("fare_final", 10, 2);
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.jsonb("pricing_snapshot_json");
    table.specificType("payment_status", "payment_status").notNullable().defaultTo("pending");
    table.string("tour_category");
    table.smallint("customer_rating");
    table.text("customer_feedback_text");
    table.smallint("driver_rating");
    table.text("driver_feedback_text");
    table.timestamp("rated_at", { useTz: true });
    table.timestamp("requested_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("accepted_at", { useTz: true });
    table.timestamp("arriving_at", { useTz: true });
    table.timestamp("started_at", { useTz: true });
    table.timestamp("completed_at", { useTz: true });
    table.timestamp("cancelled_at", { useTz: true });
    table.uuid("cancelled_by").references("id").inTable("users").onDelete("SET NULL");
    table.text("cancellation_reason");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_rides_customer ON rides (customer_id)");
  await knex.raw("CREATE INDEX idx_rides_driver ON rides (driver_id)");
  await knex.raw("CREATE INDEX idx_rides_status ON rides (status)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("rides");
  await knex.raw("DROP TYPE IF EXISTS payment_status");
  await knex.raw("DROP TYPE IF EXISTS dispatch_mode");
  await knex.raw("DROP TYPE IF EXISTS ride_status");
  await knex.raw("DROP TYPE IF EXISTS ride_type");
}
```

- [ ] **Step 2: Create `packages/server/migrations/008_create_ride_status_history.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("ride_status_history", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.specificType("old_status", "ride_status");
    table.specificType("new_status", "ride_status").notNullable();
    table.uuid("changed_by_user_id").references("id").inTable("users").onDelete("SET NULL");
    table.boolean("changed_by_system").notNullable().defaultTo(false);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_ride_status_history_ride ON ride_status_history (ride_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ride_status_history");
}
```

- [ ] **Step 3: Create `packages/server/migrations/009_create_ride_dispatch_attempts.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TYPE dispatch_response AS ENUM ('accepted', 'declined', 'timeout');
    CREATE TYPE dispatch_trigger AS ENUM ('system', 'admin');
  `);

  await knex.schema.createTable("ride_dispatch_attempts", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.uuid("driver_id").notNullable().references("id").inTable("drivers").onDelete("CASCADE");
    table.integer("attempt_no").notNullable();
    table.timestamp("sent_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("responded_at", { useTz: true });
    table.specificType("response", "dispatch_response");
    table.specificType("triggered_by", "dispatch_trigger").notNullable().defaultTo("system");
    table.integer("timeout_seconds").notNullable().defaultTo(30);
  });

  await knex.raw("CREATE INDEX idx_dispatch_attempts_ride ON ride_dispatch_attempts (ride_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ride_dispatch_attempts");
  await knex.raw("DROP TYPE IF EXISTS dispatch_trigger");
  await knex.raw("DROP TYPE IF EXISTS dispatch_response");
}
```

- [ ] **Step 4: Create `packages/server/migrations/010_create_driver_locations.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("driver_locations", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("driver_id").notNullable().references("id").inTable("drivers").onDelete("CASCADE");
    table.uuid("ride_id").references("id").inTable("rides").onDelete("SET NULL");
    table.decimal("lat", 10, 7).notNullable();
    table.decimal("lng", 10, 7).notNullable();
    table.decimal("heading", 6, 2);
    table.decimal("speed", 6, 2);
    table.timestamp("recorded_at", { useTz: true }).notNullable();
  });

  await knex.raw("CREATE INDEX idx_driver_locations_driver_time ON driver_locations (driver_id, recorded_at DESC)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("driver_locations");
}
```

- [ ] **Step 5: Run migrations**

Run: `cd packages/server && npx knex migrate:latest --knexfile knexfile.ts`
Expected: `Batch 3 run: 4 migrations`

- [ ] **Step 6: Commit**

```bash
git add packages/server/migrations/007_create_rides.ts packages/server/migrations/008_create_ride_status_history.ts packages/server/migrations/009_create_ride_dispatch_attempts.ts packages/server/migrations/010_create_driver_locations.ts
git commit -m "feat: add rides, status history, dispatch attempts, driver locations migrations"
```

---

### Task 6: Database Migrations — Messages, Payments, Push Tokens, Admin Actions

**Files:**
- Create: `packages/server/migrations/011_create_messages.ts`
- Create: `packages/server/migrations/012_create_payments.ts`
- Create: `packages/server/migrations/013_create_push_tokens.ts`
- Create: `packages/server/migrations/014_create_admin_actions.ts`

- [ ] **Step 1: Create `packages/server/migrations/011_create_messages.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE message_type AS ENUM ('text', 'system')");

  await knex.schema.createTable("messages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.uuid("sender_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.specificType("message_type", "message_type").notNullable().defaultTo("text");
    table.text("body").notNullable();
    table.timestamp("read_at", { useTz: true });
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_messages_ride ON messages (ride_id, created_at)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("messages");
  await knex.raw("DROP TYPE IF EXISTS message_type");
}
```

- [ ] **Step 2: Create `packages/server/migrations/012_create_payments.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE pay_status AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'failed')");

  await knex.schema.createTable("payments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("ride_id").notNullable().references("id").inTable("rides").onDelete("CASCADE");
    table.string("provider").notNullable().defaultTo("stripe");
    table.string("stripe_payment_intent_id");
    table.decimal("amount", 10, 2).notNullable();
    table.decimal("captured_amount", 10, 2).notNullable().defaultTo(0);
    table.decimal("refunded_amount", 10, 2).notNullable().defaultTo(0);
    table.string("currency", 3).notNullable().defaultTo("EUR");
    table.string("payment_method_type");
    table.specificType("status", "pay_status").notNullable().defaultTo("pending");
    table.text("failure_reason");
    table.timestamp("paid_at", { useTz: true });
    table.string("webhook_event_id");
    table.jsonb("metadata_json");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_payments_ride ON payments (ride_id)");
  await knex.raw("CREATE UNIQUE INDEX idx_payments_webhook ON payments (webhook_event_id) WHERE webhook_event_id IS NOT NULL");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
  await knex.raw("DROP TYPE IF EXISTS pay_status");
}
```

- [ ] **Step 3: Create `packages/server/migrations/013_create_push_tokens.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE platform_type AS ENUM ('ios', 'android')");

  await knex.schema.createTable("push_tokens", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("token").notNullable().unique();
    table.specificType("platform", "platform_type").notNullable();
  });

  await knex.raw("CREATE INDEX idx_push_tokens_user ON push_tokens (user_id)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("push_tokens");
  await knex.raw("DROP TYPE IF EXISTS platform_type");
}
```

- [ ] **Step 4: Create `packages/server/migrations/014_create_admin_actions.ts`**

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("admin_actions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
    table.uuid("admin_user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("action_type").notNullable();
    table.string("entity_type").notNullable();
    table.uuid("entity_id");
    table.jsonb("payload_json");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE INDEX idx_admin_actions_admin ON admin_actions (admin_user_id, created_at DESC)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("admin_actions");
}
```

- [ ] **Step 5: Run migrations**

Run: `cd packages/server && npx knex migrate:latest --knexfile knexfile.ts`
Expected: `Batch 4 run: 4 migrations`

- [ ] **Step 6: Commit**

```bash
git add packages/server/migrations/011_create_messages.ts packages/server/migrations/012_create_payments.ts packages/server/migrations/013_create_push_tokens.ts packages/server/migrations/014_create_admin_actions.ts
git commit -m "feat: add messages, payments, push_tokens, admin_actions migrations"
```

---

### Task 7: TypeScript Types for All Tables

**Files:**
- Create: `packages/server/src/types/db.ts`
- Create: `packages/server/src/types/api.ts`

- [ ] **Step 1: Create `packages/server/src/types/db.ts`**

```typescript
// ── Enums ──

export type UserRole = "customer" | "driver" | "admin";
export type UserLanguage = "it" | "en";
export type DriverStatus = "offline" | "available" | "busy" | "paused" | "suspended";
export type VehicleType = "standard" | "monovolume";
export type RideType = "immediate" | "reservation" | "tour";
export type RideStatus = "pending" | "accepted" | "arriving" | "in_progress" | "completed" | "cancelled" | "expired" | "no_show";
export type DispatchMode = "auto" | "manual";
export type PaymentStatus = "pending" | "authorized" | "captured" | "refunded" | "failed";
export type DispatchResponse = "accepted" | "declined" | "timeout";
export type DispatchTrigger = "system" | "admin";
export type MessageType = "text" | "system";
export type PlatformType = "ios" | "android";
export type TourCategory = "culture" | "food_wine" | "nature" | "outlet";

// ── Table Row Types ──

export interface UserRow {
  id: string;
  role: UserRole;
  name: string;
  email: string | null;
  phone: string;
  password_hash: string | null;
  language: UserLanguage;
  avatar: string | null;
  created_at: Date;
}

export interface DriverRow {
  id: string;
  user_id: string;
  license_plate: string;
  vehicle_type: VehicleType;
  vehicle_model: string | null;
  vehicle_color: string | null;
  max_capacity: number;
  status: DriverStatus;
  is_verified: boolean;
  service_zone: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_at: Date | null;
}

export interface ZoneRow {
  id: string;
  name: string;
  city: string;
  polygon: string; // PostGIS geometry, queried via ST_ functions
  active: boolean;
}

export interface FixedRouteRow {
  id: string;
  name: string;
  origin_zone_id: string;
  destination_zone_id: string;
  min_price: number;
  max_price: number;
}

export interface PricingRuleRow {
  id: string;
  base_fare: number;
  per_km: number;
  per_minute: number;
  night_surcharge_pct: number;
  minimum_fare: number;
  cancellation_fee: number;
  reservation_fee: number;
  vehicle_type_multiplier: Record<VehicleType, number>;
  time_window: string | null; // tstzrange
  updated_by: string | null;
  updated_at: Date;
}

export interface RideRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  type: RideType;
  status: RideStatus;
  dispatch_mode: DispatchMode;
  pickup_lat: number;
  pickup_lng: number;
  destination_lat: number;
  destination_lng: number;
  pickup_address: string;
  destination_address: string;
  scheduled_at: Date | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  fare_estimate: number | null;
  fare_final: number | null;
  currency: string;
  pricing_snapshot_json: PricingRuleRow | null;
  payment_status: PaymentStatus;
  tour_category: TourCategory | null;
  customer_rating: number | null;
  customer_feedback_text: string | null;
  driver_rating: number | null;
  driver_feedback_text: string | null;
  rated_at: Date | null;
  requested_at: Date;
  accepted_at: Date | null;
  arriving_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: Date;
}

export interface RideStatusHistoryRow {
  id: string;
  ride_id: string;
  old_status: RideStatus | null;
  new_status: RideStatus;
  changed_by_user_id: string | null;
  changed_by_system: boolean;
  created_at: Date;
}

export interface RideDispatchAttemptRow {
  id: string;
  ride_id: string;
  driver_id: string;
  attempt_no: number;
  sent_at: Date;
  responded_at: Date | null;
  response: DispatchResponse | null;
  triggered_by: DispatchTrigger;
  timeout_seconds: number;
}

export interface DriverLocationRow {
  id: string;
  driver_id: string;
  ride_id: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  recorded_at: Date;
}

export interface MessageRow {
  id: string;
  ride_id: string;
  sender_id: string;
  message_type: MessageType;
  body: string;
  read_at: Date | null;
  created_at: Date;
}

export interface PaymentRow {
  id: string;
  ride_id: string;
  provider: string;
  stripe_payment_intent_id: string | null;
  amount: number;
  captured_amount: number;
  refunded_amount: number;
  currency: string;
  payment_method_type: string | null;
  status: PaymentStatus;
  failure_reason: string | null;
  paid_at: Date | null;
  webhook_event_id: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: PlatformType;
}

export interface AdminActionRow {
  id: string;
  admin_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: Date;
}
```

- [ ] **Step 2: Create `packages/server/src/types/api.ts`**

```typescript
import type { UserRole, UserLanguage } from "./db";

// ── Auth Request/Response Types ──

export interface RegisterRequest {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  language?: UserLanguage;
}

export interface LoginEmailRequest {
  email: string;
  password: string;
}

export interface RequestOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  code: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    role: UserRole;
    language: UserLanguage;
    avatar: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/types/db.ts packages/server/src/types/api.ts
git commit -m "feat: add TypeScript types for all 14 DB tables and auth API"
```

---

### Task 8: Test Infrastructure

**Files:**
- Create: `packages/server/jest.config.ts`
- Create: `packages/server/tests/setup.ts`
- Create: `packages/server/tests/helpers.ts`

- [ ] **Step 1: Create `packages/server/jest.config.ts`**

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  setupFilesAfterSetup: ["<rootDir>/tests/setup.ts"],
  testTimeout: 15000,
  globalSetup: undefined,
  globalTeardown: undefined,
};

export default config;
```

- [ ] **Step 2: Create `packages/server/tests/setup.ts`**

```typescript
import knex, { Knex } from "knex";
import knexConfig from "../knexfile";

let testDb: Knex;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  testDb = knex(knexConfig.test);
  await testDb.migrate.latest();
});

afterAll(async () => {
  await testDb.migrate.rollback(undefined, true);
  await testDb.destroy();
});

export { testDb };
```

- [ ] **Step 3: Create `packages/server/tests/helpers.ts`**

```typescript
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import type { Knex } from "knex";
import type { UserRole, UserLanguage } from "../src/types/db";

export async function createTestUser(
  db: Knex,
  overrides: {
    role?: UserRole;
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    language?: UserLanguage;
  } = {}
) {
  const id = uuidv4();
  const passwordHash = overrides.password
    ? await bcrypt.hash(overrides.password, 10)
    : null;

  const user = {
    id,
    role: overrides.role || "customer",
    name: overrides.name || "Test User",
    email: overrides.email || `test-${id.slice(0, 8)}@example.com`,
    phone: overrides.phone || `+39${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    password_hash: passwordHash,
    language: overrides.language || "it",
  };

  await db("users").insert(user);
  return { ...user, password: overrides.password };
}

export async function createTestDriver(
  db: Knex,
  userId: string,
  overrides: {
    licensePlate?: string;
    vehicleType?: "standard" | "monovolume";
    status?: string;
    isVerified?: boolean;
    currentLat?: number;
    currentLng?: number;
  } = {}
) {
  const id = uuidv4();
  const driver = {
    id,
    user_id: userId,
    license_plate: overrides.licensePlate || "XX000XX",
    vehicle_type: overrides.vehicleType || "standard",
    max_capacity: 4,
    status: overrides.status || "available",
    is_verified: overrides.isVerified !== undefined ? overrides.isVerified : true,
    current_lat: overrides.currentLat || 43.4034,
    current_lng: overrides.currentLng || 13.5498,
    last_location_at: new Date(),
  };

  await db("drivers").insert(driver);
  return driver;
}

export async function createTestPricingRule(
  db: Knex,
  overrides: {
    baseFare?: number;
    perKm?: number;
    perMinute?: number;
    nightSurchargePct?: number;
    minimumFare?: number;
  } = {}
) {
  const id = uuidv4();
  const rule = {
    id,
    base_fare: overrides.baseFare || 5.0,
    per_km: overrides.perKm || 1.2,
    per_minute: overrides.perMinute || 0.3,
    night_surcharge_pct: overrides.nightSurchargePct || 20.0,
    minimum_fare: overrides.minimumFare || 8.0,
    cancellation_fee: 5.0,
    reservation_fee: 3.0,
    vehicle_type_multiplier: JSON.stringify({ standard: 1.0, monovolume: 1.3 }),
  };

  await db("pricing_rules").insert(rule);
  return rule;
}

export function cleanTables(db: Knex) {
  return async () => {
    await db.raw("TRUNCATE admin_actions, push_tokens, payments, messages, driver_locations, ride_dispatch_attempts, ride_status_history, rides, fixed_routes, pricing_rules, drivers, zones, users CASCADE");
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/jest.config.ts packages/server/tests/setup.ts packages/server/tests/helpers.ts
git commit -m "feat: add Jest config, test setup with migration runner, test helpers"
```

---

### Task 9: Migration Smoke Test

**Files:**
- Create: `packages/server/tests/migrations.test.ts`

- [ ] **Step 1: Write the migration smoke test**

```typescript
import knex, { Knex } from "knex";
import knexConfig from "../knexfile";

let db: Knex;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  db = knex(knexConfig.test);
});

afterAll(async () => {
  await db.destroy();
});

describe("Database migrations", () => {
  test("all migrations run successfully", async () => {
    // Rollback everything first
    await db.migrate.rollback(undefined, true);

    // Run all migrations
    const [batchNo, migrations] = await db.migrate.latest();
    expect(batchNo).toBe(1);
    expect(migrations.length).toBe(14);
  });

  test("all 14 tables exist after migration", async () => {
    const result = await db.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'knex_%'
      AND table_name != 'spatial_ref_sys'
      ORDER BY table_name
    `);

    const tableNames = result.rows.map((r: { table_name: string }) => r.table_name);
    expect(tableNames).toEqual([
      "admin_actions",
      "driver_locations",
      "drivers",
      "fixed_routes",
      "messages",
      "payments",
      "pricing_rules",
      "push_tokens",
      "ride_dispatch_attempts",
      "ride_status_history",
      "rides",
      "users",
      "zones",
    ]);
  });

  test("PostGIS extension is enabled", async () => {
    const result = await db.raw("SELECT PostGIS_Version()");
    expect(result.rows[0].postgis_version).toBeDefined();
  });

  test("uuid-ossp extension is enabled", async () => {
    const result = await db.raw("SELECT uuid_generate_v4()");
    expect(result.rows[0].uuid_generate_v4).toBeDefined();
  });

  test("all migrations roll back cleanly", async () => {
    await db.migrate.rollback(undefined, true);

    const result = await db.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'knex_%'
      AND table_name != 'spatial_ref_sys'
    `);

    expect(result.rows.length).toBe(0);

    // Re-run for other tests
    await db.migrate.latest();
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd packages/server && npx jest tests/migrations.test.ts --verbose`
Expected: All 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/server/tests/migrations.test.ts
git commit -m "test: add migration smoke tests for all 14 tables"
```

---

### Task 10: Express App Skeleton + Middleware

**Files:**
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/middleware/errorHandler.ts`
- Create: `packages/server/src/middleware/rateLimiter.ts`

- [ ] **Step 1: Create `packages/server/src/middleware/errorHandler.ts`**

```typescript
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected error occurred",
    statusCode: 500,
  });
}
```

- [ ] **Step 2: Create `packages/server/src/middleware/rateLimiter.ts`**

```typescript
import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many requests, please try again later",
    statusCode: 429,
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TooManyRequests",
    message: "Too many auth attempts, please try again later",
    statusCode: 429,
  },
});
```

- [ ] **Step 3: Create `packages/server/src/index.ts`**

```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api", apiLimiter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes will be mounted here:
// app.use("/api/auth", authRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server (only when not imported for testing)
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(config.port, () => {
    console.log(`Taxi Recanati API running on port ${config.port}`);
  });
}

export { app, httpServer };
```

- [ ] **Step 4: Verify the server starts**

Run: `cd packages/server && npx tsx src/index.ts &`
Then: `curl http://localhost:3000/health`
Expected: `{"status":"ok","timestamp":"..."}`
Stop the server after verifying.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/index.ts packages/server/src/middleware/errorHandler.ts packages/server/src/middleware/rateLimiter.ts
git commit -m "feat: add Express app skeleton with health check, error handler, rate limiter"
```

---

### Task 11: Auth Middleware (JWT + Role Guard)

**Files:**
- Create: `packages/server/src/middleware/auth.ts`
- Create: `packages/server/src/middleware/requireRole.ts`
- Create: `packages/server/tests/middleware.test.ts`

- [ ] **Step 1: Write the failing tests for auth middleware**

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../src/middleware/auth";
import { requireRole } from "../src/middleware/requireRole";
import { config } from "../src/config";

// Mock Express objects
function mockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers };
}

function mockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const mockNext: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authenticate middleware", () => {
  test("rejects request with no Authorization header", () => {
    const req = mockReq();
    const res = mockRes();

    authenticate(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Unauthorized" })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("rejects request with invalid token", () => {
    const req = mockReq({ authorization: "Bearer invalid-token" });
    const res = mockRes();

    authenticate(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("passes with valid token and sets req.user", () => {
    const token = jwt.sign(
      { userId: "test-uuid", role: "customer" },
      config.jwt.secret,
      { expiresIn: "15m" }
    );
    const req = mockReq({ authorization: `Bearer ${token}` });
    const res = mockRes();

    authenticate(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect((req as any).user).toEqual(
      expect.objectContaining({ userId: "test-uuid", role: "customer" })
    );
  });
});

describe("requireRole middleware", () => {
  test("rejects user without required role", () => {
    const req = mockReq();
    (req as any).user = { userId: "test-uuid", role: "customer" };
    const res = mockRes();

    requireRole("admin")(req as Request, res as Response, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  test("allows user with required role", () => {
    const req = mockReq();
    (req as any).user = { userId: "test-uuid", role: "admin" };
    const res = mockRes();

    requireRole("admin")(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  test("allows any of multiple roles", () => {
    const req = mockReq();
    (req as any).user = { userId: "test-uuid", role: "driver" };
    const res = mockRes();

    requireRole("driver", "admin")(req as Request, res as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/server && npx jest tests/middleware.test.ts --verbose`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `packages/server/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { TokenPayload } from "../types/api";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid authorization header",
      statusCode: 401,
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as TokenPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
      statusCode: 401,
    });
  }
}
```

- [ ] **Step 4: Create `packages/server/src/middleware/requireRole.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types/db";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        error: "Forbidden",
        message: "You do not have permission to access this resource",
        statusCode: 403,
      });
      return;
    }
    next();
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/server && npx jest tests/middleware.test.ts --verbose`
Expected: All 6 tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/middleware/auth.ts packages/server/src/middleware/requireRole.ts packages/server/tests/middleware.test.ts
git commit -m "feat: add JWT auth middleware and role guard with tests"
```

---

### Task 12: Auth Validators (Zod)

**Files:**
- Create: `packages/server/src/validators/auth.validators.ts`

- [ ] **Step 1: Create `packages/server/src/validators/auth.validators.ts`**

```typescript
import { z } from "zod";

export const registerSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format (e.g. +393271234567)"),
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  language: z.enum(["it", "en"]).optional().default("it"),
});

export const loginEmailSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const requestOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format"),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Phone must be in E.164 format"),
  code: z.string().length(6, "OTP code must be 6 digits"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/validators/auth.validators.ts
git commit -m "feat: add Zod validation schemas for auth endpoints"
```

---

### Task 13: Auth Service

**Files:**
- Create: `packages/server/src/services/auth.service.ts`

- [ ] **Step 1: Create `packages/server/src/services/auth.service.ts`**

```typescript
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../db";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import type { UserRow } from "../types/db";
import type { AuthResponse, TokenPayload } from "../types/api";

const SALT_ROUNDS = 10;

function generateTokens(userId: string, role: string): { accessToken: string; refreshToken: string } {
  const payload: TokenPayload = { userId, role: role as TokenPayload["role"] };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}

function toAuthResponse(user: UserRow, accessToken: string, refreshToken: string): AuthResponse {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      language: user.language,
      avatar: user.avatar,
    },
    accessToken,
    refreshToken,
  };
}

export async function register(data: {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  language?: "it" | "en";
}): Promise<AuthResponse> {
  const existing = await db("users").where("phone", data.phone).first();
  if (existing) {
    throw new AppError(409, "A user with this phone number already exists");
  }

  if (data.email) {
    const emailExists = await db("users").where("email", data.email).first();
    if (emailExists) {
      throw new AppError(409, "A user with this email already exists");
    }
  }

  const passwordHash = data.password
    ? await bcrypt.hash(data.password, SALT_ROUNDS)
    : null;

  const [user] = await db("users")
    .insert({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      password_hash: passwordHash,
      language: data.language || "it",
      role: "customer",
    })
    .returning("*");

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  return toAuthResponse(user, accessToken, refreshToken);
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  const user: UserRow | undefined = await db("users").where("email", email).first();

  if (!user || !user.password_hash) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  return toAuthResponse(user, accessToken, refreshToken);
}

export async function loginWithPhone(phone: string): Promise<AuthResponse> {
  const user: UserRow | undefined = await db("users").where("phone", phone).first();

  if (!user) {
    throw new AppError(404, "No user found with this phone number");
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  return toAuthResponse(user, accessToken, refreshToken);
}

export async function refreshAccessToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
    const user: UserRow | undefined = await db("users").where("id", payload.userId).first();

    if (!user) {
      throw new AppError(401, "User not found");
    }

    return generateTokens(user.id, user.role);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, "Invalid or expired refresh token");
  }
}

export async function getUserById(userId: string): Promise<UserRow | undefined> {
  return db("users").where("id", userId).first();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/services/auth.service.ts
git commit -m "feat: add auth service with register, email login, phone login, token refresh"
```

---

### Task 14: Auth Routes

**Files:**
- Create: `packages/server/src/routes/auth.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Create `packages/server/src/routes/auth.ts`**

```typescript
import { Router, Request, Response, NextFunction } from "express";
import { authLimiter } from "../middleware/rateLimiter";
import { authenticate } from "../middleware/auth";
import {
  registerSchema,
  loginEmailSchema,
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
} from "../validators/auth.validators";
import * as authService from "../services/auth.service";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// POST /api/auth/register
router.post("/register", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

// POST /api/auth/login/email
router.post("/login/email", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginEmailSchema.parse(req.body);
    const result = await authService.loginWithEmail(email, password);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

// POST /api/auth/otp/request
// In production, this calls Twilio Verify to send SMS.
// For MVP/dev, we skip the actual SMS and accept any 6-digit code.
router.post("/otp/request", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = requestOtpSchema.parse(req.body);
    // TODO (Plan 1 scope): Twilio integration is stubbed.
    // In dev mode, any 6-digit code works. In production, wire up Twilio Verify.
    res.json({ message: "OTP sent", phone });
  } catch (err) {
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

// POST /api/auth/otp/verify
router.post("/otp/verify", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = verifyOtpSchema.parse(req.body);

    // Dev mode: accept any 6-digit code
    // Production: verify via Twilio Verify API
    if (code.length !== 6) {
      throw new AppError(401, "Invalid OTP code");
    }

    const result = await authService.loginWithPhone(phone);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

// POST /api/auth/refresh
router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json(tokens);
  } catch (err) {
    if (err instanceof AppError) return next(err);
    if ((err as any).name === "ZodError") {
      return res.status(400).json({
        error: "ValidationError",
        message: (err as any).errors[0].message,
        statusCode: 400,
      });
    }
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserById(req.user!.userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      language: user.language,
      avatar: user.avatar,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Mount auth routes in `packages/server/src/index.ts`**

Replace the comment `// Routes will be mounted here:` and the line below it with:

```typescript
import authRoutes from "./routes/auth";
app.use("/api/auth", authRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/routes/auth.ts packages/server/src/index.ts
git commit -m "feat: add auth routes (register, email login, OTP stub, refresh, me)"
```

---

### Task 15: Auth Integration Tests

**Files:**
- Create: `packages/server/tests/auth.test.ts`

- [ ] **Step 1: Write the auth integration tests**

```typescript
import request from "supertest";
import knex, { Knex } from "knex";
import knexConfig from "../knexfile";
import { app } from "../src/index";
import { createTestUser, cleanTables } from "./helpers";

let db: Knex;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  db = knex(knexConfig.test);
  await db.migrate.latest();

  // Inject test DB into the app's db module
  jest.mock("../src/db", () => db);
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
    // Password hash must not be in response
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
```

- [ ] **Step 2: Run the tests**

Run: `cd packages/server && npx jest tests/auth.test.ts --verbose`
Expected: All 9 tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/server/tests/auth.test.ts
git commit -m "test: add auth integration tests for register, login, refresh, me"
```

---

### Task 16: Dev Seed Data

**Files:**
- Create: `packages/server/seeds/001_dev_seed.ts`

- [ ] **Step 1: Create `packages/server/seeds/001_dev_seed.ts`**

```typescript
import { Knex } from "knex";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export async function seed(knex: Knex): Promise<void> {
  // Clean all tables
  await knex.raw("TRUNCATE admin_actions, push_tokens, payments, messages, driver_locations, ride_dispatch_attempts, ride_status_history, rides, fixed_routes, pricing_rules, drivers, zones, users CASCADE");

  // ── Admin user (David) ──
  const adminId = uuidv4();
  const adminPassword = await bcrypt.hash("admin123", 10);
  await knex("users").insert({
    id: adminId,
    role: "admin",
    name: "David Leonori",
    email: "david@taxirecanati.it",
    phone: "+393272047842",
    password_hash: adminPassword,
    language: "it",
  });

  // ── Driver user (Marco) ──
  const driverUserId = uuidv4();
  const driverPassword = await bcrypt.hash("driver123", 10);
  await knex("users").insert({
    id: driverUserId,
    role: "driver",
    name: "Marco Rossi",
    email: "marco@taxirecanati.it",
    phone: "+393331234567",
    password_hash: driverPassword,
    language: "it",
  });

  // ── Customer user ──
  const customerUserId = uuidv4();
  await knex("users").insert({
    id: customerUserId,
    role: "customer",
    name: "Laura Bianchi",
    email: "laura@example.com",
    phone: "+393281111111",
    password_hash: await bcrypt.hash("customer123", 10),
    language: "en",
  });

  // ── Zones ──
  const recanatiZoneId = uuidv4();
  const anconaAirportZoneId = uuidv4();
  const loretoStationZoneId = uuidv4();

  await knex("zones").insert([
    {
      id: recanatiZoneId,
      name: "Recanati Centro",
      city: "Recanati",
      polygon: knex.raw(
        "ST_GeomFromText('POLYGON((13.53 43.39, 13.57 43.39, 13.57 43.42, 13.53 43.42, 13.53 43.39))', 4326)"
      ),
      active: true,
    },
    {
      id: anconaAirportZoneId,
      name: "Ancona Falconara Airport",
      city: "Falconara Marittima",
      polygon: knex.raw(
        "ST_GeomFromText('POLYGON((13.35 43.60, 13.38 43.60, 13.38 43.63, 13.35 43.63, 13.35 43.60))', 4326)"
      ),
      active: true,
    },
    {
      id: loretoStationZoneId,
      name: "Loreto Station",
      city: "Loreto",
      polygon: knex.raw(
        "ST_GeomFromText('POLYGON((13.59 43.43, 13.62 43.43, 13.62 43.45, 13.59 43.45, 13.59 43.43))', 4326)"
      ),
      active: true,
    },
  ]);

  // ── Driver (linked to Marco) ──
  const driverId = uuidv4();
  await knex("drivers").insert({
    id: driverId,
    user_id: driverUserId,
    license_plate: "FG123AB",
    vehicle_type: "standard",
    vehicle_model: "Fiat 500L",
    vehicle_color: "White",
    max_capacity: 4,
    status: "available",
    is_verified: true,
    service_zone: recanatiZoneId,
    current_lat: 43.4034,
    current_lng: 13.5498,
    last_location_at: new Date(),
  });

  // ── David as driver too ──
  const adminDriverId = uuidv4();
  await knex("drivers").insert({
    id: adminDriverId,
    user_id: adminId,
    license_plate: "MC987ZZ",
    vehicle_type: "monovolume",
    vehicle_model: "Mercedes Vito",
    vehicle_color: "Black",
    max_capacity: 7,
    status: "available",
    is_verified: true,
    service_zone: recanatiZoneId,
    current_lat: 43.4050,
    current_lng: 13.5510,
    last_location_at: new Date(),
  });

  // ── Fixed routes ──
  await knex("fixed_routes").insert([
    {
      name: "Recanati → Ancona Airport",
      origin_zone_id: recanatiZoneId,
      destination_zone_id: anconaAirportZoneId,
      min_price: 45.0,
      max_price: 55.0,
    },
    {
      name: "Recanati → Loreto Station",
      origin_zone_id: recanatiZoneId,
      destination_zone_id: loretoStationZoneId,
      min_price: 12.0,
      max_price: 18.0,
    },
  ]);

  // ── Pricing rules (default) ──
  await knex("pricing_rules").insert({
    base_fare: 5.0,
    per_km: 1.2,
    per_minute: 0.3,
    night_surcharge_pct: 20.0,
    minimum_fare: 8.0,
    cancellation_fee: 5.0,
    reservation_fee: 3.0,
    vehicle_type_multiplier: JSON.stringify({ standard: 1.0, monovolume: 1.3 }),
    updated_by: adminId,
  });

  console.log("Dev seed complete: admin (david@taxirecanati.it / admin123), driver (marco@taxirecanati.it / driver123), customer (laura@example.com / customer123)");
}
```

- [ ] **Step 2: Run the seed**

Run: `cd packages/server && npx knex seed:run --knexfile knexfile.ts`
Expected: `Ran 1 seed files` + console output with login credentials

- [ ] **Step 3: Commit**

```bash
git add packages/server/seeds/001_dev_seed.ts
git commit -m "feat: add dev seed with admin, driver, customer, zones, routes, pricing"
```

---

### Task 17: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `cd packages/server && npx jest --verbose`
Expected: All tests pass (migrations + middleware + auth)

- [ ] **Step 2: Verify the dev server starts with seed data**

Run: `cd packages/server && npx tsx src/index.ts &`
Then: `curl http://localhost:3000/health`
Then: `curl -X POST http://localhost:3000/api/auth/login/email -H "Content-Type: application/json" -d '{"email":"david@taxirecanati.it","password":"admin123"}'`
Expected: Health returns OK. Login returns tokens with role `admin`.
Stop the server after verifying.

- [ ] **Step 3: Final commit for Plan 1**

```bash
git add -A
git commit -m "chore: Plan 1 complete — backend foundation with DB, auth, and tests"
```

---

## Plan Summary

| Task | What It Delivers | Files |
|------|-----------------|-------|
| 1 | Turborepo monorepo, Docker Compose, server package | 8 files |
| 2 | Knex config, env loader, DB connection | 3 files |
| 3 | Extensions + users migration | 2 files |
| 4 | Zones, drivers, fixed routes, pricing migrations | 4 files |
| 5 | Rides, status history, dispatch attempts, locations | 4 files |
| 6 | Messages, payments, push tokens, admin actions | 4 files |
| 7 | TypeScript types for all 14 tables + API types | 2 files |
| 8 | Jest config, test setup, test helpers | 3 files |
| 9 | Migration smoke test (14 tables + extensions) | 1 file |
| 10 | Express app, error handler, rate limiter | 3 files |
| 11 | JWT auth middleware + role guard + tests | 3 files |
| 12 | Zod validation schemas for auth | 1 file |
| 13 | Auth service (register, login, refresh) | 1 file |
| 14 | Auth routes mounted on Express | 2 files |
| 15 | Auth integration tests | 1 file |
| 16 | Dev seed data | 1 file |
| 17 | Full test suite run + end-to-end verify | 0 files |

**Total: 17 tasks, ~43 files, all with complete code**
