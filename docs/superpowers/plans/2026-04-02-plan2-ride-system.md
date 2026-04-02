# Plan 2: Ride System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete ride lifecycle — fare estimation, ride creation, state machine with transition validation, auto-dispatch with nearest-driver PostGIS queries, manual admin dispatch, ride history, and ride rating.

**Depends on:** Plan 1 (Backend Foundation) — all 14 migrations, auth system, types, test infrastructure.

**Tech Stack:** Express routes, Knex.js transactions, PostGIS spatial queries, Zod validation, Jest + Supertest.

---

## File Structure (new/modified files)

```
packages/server/src/
├── services/
│   ├── pricing.service.ts        # Fare estimation + pricing snapshot
│   ├── ride.service.ts           # Ride CRUD + state machine
│   └── dispatch.service.ts       # Auto-dispatch + manual dispatch
├── routes/
│   └── rides.ts                  # All /api/rides/* endpoints
├── validators/
│   └── ride.validators.ts        # Zod schemas for ride requests
├── types/
│   └── rides.ts                  # Ride-specific types (state machine, etc.)
packages/server/tests/
├── pricing.test.ts               # Fare calculation tests
├── rides.test.ts                 # Ride CRUD + state machine tests
├── dispatch.test.ts              # Dispatch logic tests
```

---

## Tasks

### Task 1: Ride Types & Constants
- [ ] Create `src/types/rides.ts` with:
  - `VALID_TRANSITIONS` map: for each status, the list of allowed next statuses (from spec Section 5)
  - `TERMINAL_STATUSES`: `['completed', 'cancelled', 'expired', 'no_show']`
  - `RideCreateInput`, `FareEstimateInput`, `RideStatusUpdate` types
  - `PricingSnapshot` type matching `pricing_snapshot_json` JSONB structure

### Task 2: Ride Validators (Zod)
- [ ] Create `src/validators/ride.validators.ts` with:
  - `createRideSchema`: pickup_lat, pickup_lng, dropoff_lat, dropoff_lng (all required numbers), ride_type (`immediate` | `reservation`), scheduled_at (optional ISO string, required if reservation), vehicle_type (`standard` | `monovolume`), notes (optional string)
  - `fareEstimateSchema`: pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type
  - `updateStatusSchema`: status (enum of ride statuses), cancellation_reason (optional, required when status is `cancelled`)
  - `rateRideSchema`: rating (integer 1-5), rating_comment (optional string)

### Task 3: Pricing Service
- [ ] Create `src/services/pricing.service.ts` with:
  - `getActivePricingRule()`: fetches the current active pricing rule (where `time_window` contains NOW or is null, prefer specific over null)
  - `checkFixedRoute(pickupLat, pickupLng, dropoffLat, dropoffLng)`: uses PostGIS `ST_Contains` to find if pickup and dropoff are in zones that match a `fixed_routes` entry. Returns the fixed route or null
  - `calculateFare(distanceMeters, durationSeconds, vehicleType, pricingRule)`: applies formula: `base_fare + (per_km * distance_km) + (per_minute * duration_min)`, applies `night_surcharge_pct` if current hour is 22-06, applies `vehicle_type_multiplier`, enforces `minimum_fare`. Returns `{ estimatedFare, breakdown }`
  - `buildPricingSnapshot(pricingRule)`: serializes the pricing rule into a JSONB-ready object
  - All money calculations use integer cents internally to avoid floating point issues, convert to EUR decimals on output

### Task 4: Dispatch Service
- [ ] Create `src/services/dispatch.service.ts` with:
  - `findNearestDrivers(lat, lng, radiusKm, limit)`: PostGIS query using `ST_DWithin` on `drivers.current_lat/current_lng`, filtered by `status = 'available'`, `is_verified = true`, `last_location_at` within 60 seconds. Returns drivers ordered by distance
  - `attemptDispatch(rideId, driverId, attemptNo, triggeredBy)`: inserts into `ride_dispatch_attempts`, emits `ride:request` event (stubbed for now — Socket.io will be wired in Plan 3). Returns the dispatch attempt row
  - `runAutoDispatch(rideId)`: finds nearest drivers, attempts dispatch to first available. Logs each attempt. For now, synchronous single-attempt (timeout/retry will be wired with Socket.io in Plan 3)
  - `manualDispatch(rideId, driverId, adminUserId)`: admin assigns a ride to a specific driver. Uses `SELECT FOR UPDATE` on the ride, validates ride is `pending`, updates status to `accepted`, inserts `ride_status_history`, inserts `ride_dispatch_attempts` with `triggered_by = 'admin'`, logs to `admin_actions`

### Task 5: Ride Service (CRUD + State Machine)
- [ ] Create `src/services/ride.service.ts` with:
  - `createRide(customerId, input)`: creates ride in `pending` status. Calls `getActivePricingRule()` to build pricing snapshot. Calls `calculateFare()` for estimated fare. Inserts ride row. Inserts initial `ride_status_history` entry (null → pending). If immediate, triggers `runAutoDispatch()`. Returns ride with estimate
  - `updateRideStatus(rideId, newStatus, userId, opts)`: validates transition against `VALID_TRANSITIONS`. Opens transaction with `SELECT FOR UPDATE` on ride row. Updates ride status + timestamps (accepted_at, arriving_at, started_at, completed_at, cancelled_at as appropriate). Inserts `ride_status_history`. If accepting: sets `driver_id`, updates driver status to `on_ride`. If completing: sets `fare_final`. If cancelling: requires `cancelled_by` and `cancellation_reason`. Returns updated ride
  - `getRideById(rideId)`: returns ride with driver and customer info joined
  - `getActiveRide(userId)`: returns user's non-terminal ride (for "current ride" screen)
  - `getRideHistory(userId, page, limit)`: paginated ride history for customer or driver
  - `rateRide(rideId, userId, rating, comment)`: validates ride is `completed`, user is the customer, not already rated. Updates `rating`, `rating_comment`, `rated_at` on ride row

### Task 6: Ride Routes
- [ ] Create `src/routes/rides.ts` with:
  - `POST /api/rides/estimate` — fare estimate (auth required, any role)
  - `POST /api/rides` — create ride (auth required, customer only)
  - `GET /api/rides/active` — get current active ride (auth required)
  - `GET /api/rides/:id` — get ride details (auth required, must be participant or admin)
  - `PATCH /api/rides/:id/status` — update ride status (auth required, role-based: customer can cancel, driver can accept/arriving/in_progress/complete/no_show, admin can do anything)
  - `POST /api/rides/:id/rate` — rate completed ride (auth required, customer only)
  - `GET /api/rides/history` — paginated ride history (auth required)
  - `POST /api/rides/:id/dispatch` — manual admin dispatch (auth required, admin only). Body: `{ driverId }`
- [ ] Mount rides routes in `src/index.ts` at `/api/rides`

### Task 7: Pricing Tests
- [ ] Create `tests/pricing.test.ts`:
  - Test `calculateFare` returns correct fare for a standard daytime ride
  - Test night surcharge is applied between 22:00-06:00
  - Test vehicle_type_multiplier applies for monovolume
  - Test minimum_fare is enforced when calculated fare is lower
  - Test fixed route detection when pickup/dropoff fall within matching zones
  - Test no fixed route when zones don't match

### Task 8: Ride CRUD & State Machine Tests
- [ ] Create `tests/rides.test.ts`:
  - Test create ride returns 201 with estimated fare and pending status
  - Test create ride stores pricing snapshot
  - Test accepting ride transitions from pending → accepted and sets driver_id
  - Test accepting already-accepted ride returns 409 (concurrency)
  - Test full happy path: pending → accepted → arriving → in_progress → completed
  - Test invalid transition returns 400 (e.g. pending → in_progress)
  - Test cancellation requires reason
  - Test customer can cancel pending ride
  - Test rating a completed ride works
  - Test rating a non-completed ride returns 400
  - Test ride history returns paginated results

### Task 9: Dispatch Tests
- [ ] Create `tests/dispatch.test.ts`:
  - Test `findNearestDrivers` returns drivers ordered by distance
  - Test `findNearestDrivers` excludes offline/paused drivers
  - Test `findNearestDrivers` excludes drivers with stale location (>60s)
  - Test `manualDispatch` assigns ride and logs admin action
  - Test `manualDispatch` on non-pending ride returns error
  - Test auto-dispatch creates dispatch attempt record

### Task 10: Run Full Test Suite
- [ ] Run `npx jest --verbose` and verify all tests pass
- [ ] Fix any issues found
- [ ] Commit all changes

---

## Acceptance Criteria

1. Fare estimation returns correct pricing with night surcharge, vehicle multiplier, minimum fare, and fixed route detection
2. Rides follow the state machine strictly — invalid transitions are rejected
3. All status updates are atomic (transaction + row-level locking)
4. Every status change writes to `ride_status_history`
5. Nearest-driver query uses PostGIS spatial functions correctly
6. Manual dispatch validates ride state and logs to `admin_actions`
7. All tests pass (pricing, rides, dispatch)
