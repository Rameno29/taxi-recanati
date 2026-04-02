# Plan 3: Real-Time & Messaging — Implementation Plan

**Goal:** Wire Socket.io for real-time GPS tracking, ride status broadcasts, dispatch timeout/retry, in-app chat, and driver location updates. Add REST endpoints for messages and driver location/status management.

**Depends on:** Plan 1 (auth, middleware), Plan 2 (rides, dispatch, pricing).

---

## Tasks

### Task 1: Socket.io Server Setup
- [ ] Create `src/socket.ts` — initialize Socket.io on the existing HTTP server
  - JWT authentication middleware for socket connections (verify token from `auth` query param or handshake)
  - Auto-join rooms: `driver:{driver_id}` for drivers, `admin` for admins
  - Join `ride:{ride_id}` when a ride is active for user
  - Heartbeat: 25s interval, 10s timeout
  - Export `io` instance for use by services

### Task 2: GPS Location Handler
- [ ] Create `src/handlers/location.handler.ts`
  - Listen for `driver:location` event: `{ lat, lng, heading, speed }`
  - Update `drivers.current_lat/current_lng/last_location_at`
  - Insert row into `driver_locations` table
  - Broadcast to `ride:{ride_id}` room if driver has active ride
  - Broadcast to `admin` room

### Task 3: Ride Status Broadcasting
- [ ] Create `src/handlers/ride.handler.ts`
  - Export `broadcastRideStatus(rideId, oldStatus, newStatus)` — emits `ride:status` to `ride:{ride_id}` and `admin` rooms
  - Wire into `ride.service.ts` `updateRideStatus()` to broadcast after each transition

### Task 4: Dispatch Timeout & Retry
- [ ] Update `src/services/dispatch.service.ts`
  - `runAutoDispatch` sends `ride:request` to `driver:{driver_id}` via Socket.io
  - Set 30-second timeout per driver: if no `ride:accept` response, log `timeout` in `ride_dispatch_attempts` and try next driver
  - If all drivers exhausted, set ride to `expired`
  - Listen for `ride:accept` and `ride:decline` events from drivers

### Task 5: Chat Handler
- [ ] Create `src/handlers/chat.handler.ts`
  - Listen for `chat:message` event: `{ ride_id, body }`
  - Validate sender is participant in the ride
  - Insert into `messages` table
  - Broadcast to `ride:{ride_id}` room

### Task 6: Messages REST Routes
- [ ] Create `src/routes/messages.ts`
  - `GET /api/messages/:rideId` — list messages for a ride (auth required, must be participant or admin)
  - `POST /api/messages/:rideId` — send message (auth required, must be participant)
  - `PATCH /api/messages/:messageId/read` — mark message as read
- [ ] Create `src/services/message.service.ts`
- [ ] Create `src/validators/message.validators.ts`
- [ ] Mount in `src/index.ts` at `/api/messages`

### Task 7: Driver Routes
- [ ] Create `src/routes/drivers.ts`
  - `PATCH /api/drivers/status` — update own status (available/offline/paused) (driver only)
  - `POST /api/drivers/location` — push GPS location via REST (fallback for when socket disconnects)
  - `GET /api/drivers/earnings` — get earnings with date range query params
- [ ] Create `src/services/driver.service.ts`
- [ ] Create `src/validators/driver.validators.ts`
- [ ] Mount in `src/index.ts` at `/api/drivers`

### Task 8: Wire Socket.io into Express App
- [ ] Update `src/index.ts` to initialize Socket.io on httpServer
- [ ] Register all socket handlers (location, ride, chat)
- [ ] Export io instance

### Task 9: Tests
- [ ] Create `tests/socket.test.ts` — socket connection auth, room joining, GPS broadcast, ride status broadcast
- [ ] Create `tests/messages.test.ts` — send message, list messages, mark as read
- [ ] Create `tests/drivers.test.ts` — update status, push location, get earnings

### Task 10: Run Full Test Suite
- [ ] Run `npx jest --verbose` and verify all tests pass
- [ ] Commit all changes
