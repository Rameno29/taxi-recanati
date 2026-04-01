# Taxi Recanati — Mobile App Design Specification

## Overview

Mobile application for Taxi Recanati (taxirecanati.it), a 24/7 taxi and private ride service based in Recanati (MC), Italy, operated by David Leonori. The service covers local rides, airport/station transfers, cruise port transfers, hospital transport, package delivery, and guided taxi tours across the Marche region.

The app replaces the current phone/WhatsApp booking workflow with a full digital experience for customers and drivers.

### Goals

- Customers can book immediate rides and advance reservations from their phone
- Drivers receive and manage ride requests with GPS navigation
- David (owner/admin) can dispatch rides, manage drivers, set pricing, and view business reports
- In-app payments via Stripe replace cash/card-on-arrival
- Real-time GPS tracking for customers during rides
- Italian and English language support for tourist coverage

---

## Section 1: Architecture

### Platform

- **Framework:** React Native with Expo (TypeScript)
- **Target:** iOS + Android native apps
- **Backend:** Node.js + Express API server
- **Database:** PostgreSQL with PostGIS spatial extensions
- **Real-time:** Socket.io
- **Payments:** Stripe (credit card, Apple Pay, Google Pay)
- **Maps:** Google Maps (display + Distance Matrix API)
- **Push notifications:** Expo Push Notification Service
- **Monorepo:** Single repository containing both apps and the shared backend

### Apps Shipped

Two apps are built and published:

1. **Customer App** — booking, tracking, payments, chat, tours, ride history
2. **Driver/Admin App** — ride management, navigation, GPS sharing, earnings. David sees additional admin screens (dashboard, dispatch, driver management, pricing) behind a role check. No separate admin app.

### System Diagram

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Customer App │  │  Driver App  │  │ Admin (David)│
│  (React Native) │  (React Native) │  (same app)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
         ┌──────┴──────┐   ┌─────┴──────┐
         │  REST API   │   │  Socket.io │
         │  (Express)  │   │  (real-time)│
         └──────┬──────┘   └─────┬──────┘
                │                │
                └───────┬────────┘
                        │
                 ┌──────┴──────┐
                 │ PostgreSQL  │
                 │  + PostGIS  │
                 └─────────────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
          ┌───┴───┐ ┌───┴───┐ ┌──┴───┐
          │Stripe │ │Google │ │ Expo │
          │       │ │ Maps  │ │ Push │
          └───────┘ └───────┘ └──────┘
```

---

## Section 2: Customer App

### Authentication

- **Primary:** Phone number + OTP
- **Secondary:** Email + password, Google sign-in, Apple sign-in
- **Profile setup:** Name, phone, preferred language (Italian/English), saved payment method

### Tab Bar

| Tab | Icon | Screen |
|-----|------|--------|
| Home | 🏠 | Map + booking entry |
| Rides | 📋 | Ride history |
| Chat | 💬 | Active chat |
| Tours | 🗺️ | Tour catalog |
| Profile | 👤 | Settings, payment methods, language |

### Screens

**Home**
- Full-screen map centered on user location
- Search bar: "Where to?"
- Three quick-action buttons: Ride Now, Reserve, Tours

**Book a Ride**
- Pickup location (auto-filled from GPS, editable)
- Destination (search with autocomplete)
- Vehicle type: Standard or Monovolume
- When: Now or schedule for later (date/time picker)
- Estimated fare displayed before confirmation
- Confirm Booking button

**Live Tracking**
- Real-time map showing driver's taxi icon approaching
- Driver name and vehicle info
- Live ETA countdown
- Chat and Call buttons
- Status bar: Waiting → Driver arriving → In ride → Completed

**Chat**
- Full in-app messaging with assigned driver
- Text messages
- System messages ("Driver is arriving", "Ride completed")

**Tours**
- List of 4 tour categories:
  - Culture Tour (Recanati, Loreto, Macerata) — from €80, ~3h
  - Food & Wine (local wineries and restaurants) — from €100, ~4h
  - Nature (Monte Conero, beaches) — from €90, ~3h
  - Outlet Shopping (designer outlets) — from €60, ~2h
- Each category shows: description, estimated price, estimated duration
- Book tour button leads to reservation flow with date/time picker

**Ride History**
- Chronological list of past rides
- Each entry: destination, fare, date/time, rating status
- Tap to view ride details

**Rating**
- After ride completion: 1–5 star rating + optional text feedback
- Rating prompt appears automatically, can be dismissed and completed later from ride history

---

## Section 3: Driver / Admin App

### Driver Screens (All Drivers)

**Driver Tab Bar**

| Tab | Icon | Screen |
|-----|------|--------|
| Home | 🏠 | Status + map |
| Schedule | 📅 | Upcoming rides |
| Chat | 💬 | Active chat |
| Earnings | 💰 | Revenue overview |
| Profile | 👤 | Settings, vehicle info |

**Driver Home**
- Online/offline toggle (available / paused / offline)
- Today's stats: ride count, earnings
- Map showing current location
- Active ride card (if on a ride) or "Waiting for rides..."

**New Ride Request (Modal)**
- Pickup address and distance from driver
- Destination address and estimated trip distance/duration
- Estimated fare
- 30-second countdown timer
- Accept / Decline buttons
- Sound + vibration alert

**Active Ride**
- Navigation view with turn-by-turn directions
- Customer name and contact
- ETA to destination
- Chat / Call buttons
- Status progression buttons: Arrived at Pickup → Start Ride → Complete Ride

**Upcoming Rides**
- List of scheduled reservations and tours assigned to driver
- Color-coded by type (transfer, tour, station pickup)
- Date, time, route, fare

**Earnings**
- Weekly summary with total and ride count
- Daily breakdown
- Full history with date filtering

### Admin Screens (David Only)

David's app includes a toggle to switch between Driver view and Admin view. Admin view has its own tab bar:

| Tab | Icon | Screen |
|-----|------|--------|
| Dashboard | 📊 | Live overview |
| Dispatch | 🚀 | Manual assignment |
| Drivers | 👥 | Driver management |
| Pricing | 💲 | Rates and zones |
| Settings | ⚙️ | App config |

**Admin Dashboard**
- Live stats: drivers online, active rides, daily revenue
- Live map showing all driver positions
- Pending bookings list with "Assign" action

**Manual Dispatch**
- Select a pending booking
- View available drivers with distance from pickup and current status
- One-tap assign to any driver
- Can override auto-assigned rides

**Manage Drivers**
- Driver list with status, monthly ride count, earnings, average rating
- Add new driver (sends invite)
- Verify, pause, or suspend drivers

**Pricing & Zones**
- Base rates: base fare, per-km, per-minute, night surcharge
- Minimum fare, cancellation fee, reservation fee
- Vehicle type multipliers
- Fixed routes with min/max prices (e.g. Recanati → Ancona Airport: €45–55)
- Zone management with map editor

---

## Section 4: Backend & Data Model

### 1 — Database (PostgreSQL + PostGIS)

All geographic queries (nearest driver, zone containment) use PostGIS spatial extensions. Timestamps are stored as `timestamptz` (UTC). All tables use `id` as UUID primary key. All spatial calculations use SRID 4326 (WGS 84).

---

#### `users`

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| role | enum | `customer` / `driver` / `admin` |
| name | varchar | |
| email | varchar | unique, nullable |
| phone | varchar | unique |
| language | enum | `it` / `en` |
| avatar | varchar | URL |
| created_at | timestamptz | |

---

#### `drivers`

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| license_plate | varchar | |
| vehicle_type | enum | `standard` / `monovolume` |
| vehicle_model | varchar | e.g. "Mercedes Vito" |
| vehicle_color | varchar | |
| max_capacity | int | passenger seats |
| status | enum | `offline` / `available` / `busy` / `paused` / `suspended` |
| is_verified | boolean | admin-approved |
| service_zone | uuid | FK → zones, nullable |
| current_lat | decimal | |
| current_lng | decimal | |
| last_location_at | timestamptz | stale if >60s old |

**Status definitions:** `offline` (not working), `available` (accepting rides), `busy` (on a ride), `paused` (on break), `suspended` (admin-disabled).

**Push token resolution:** Push tokens are not stored on the driver row. A user may have multiple active devices and tokens. Push delivery resolves tokens from the `push_tokens` table, which is the single source of truth.

**Location source of truth:** `drivers.current_lat` and `drivers.current_lng` store the latest cached driver position for fast dispatch queries (PostGIS nearest-driver). The `driver_locations` table stores the full historical GPS timeline for tracking, replay, analytics, and disputes. `drivers.current_lat/current_lng` must always be updated together with the latest `driver_locations` insert inside the same database transaction.

---

#### `rides`

Central operational table. Each ride stores a pricing snapshot at creation time so the fare is auditable even if pricing rules change later.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| customer_id | uuid | FK → users |
| driver_id | uuid | FK → drivers, nullable until accepted |
| type | enum | `immediate` / `reservation` / `tour` |
| status | enum | `pending` / `accepted` / `arriving` / `in_progress` / `completed` / `cancelled` / `expired` / `no_show` |
| dispatch_mode | enum | `auto` / `manual` |
| pickup_lat | decimal | |
| pickup_lng | decimal | |
| destination_lat | decimal | |
| destination_lng | decimal | |
| pickup_address | varchar | geocoded display string |
| destination_address | varchar | geocoded display string |
| scheduled_at | timestamptz | null for immediate rides |
| distance_meters | int | from Maps API |
| duration_seconds | int | from Maps API |
| fare_estimate | decimal | shown to customer before confirm |
| fare_final | decimal | set at ride completion |
| currency | varchar | default `EUR` |
| pricing_snapshot_json | jsonb | frozen copy of pricing rules at booking time |
| payment_status | enum | `pending` / `authorized` / `captured` / `refunded` / `failed` |
| tour_category | varchar | nullable — `culture` / `food_wine` / `nature` / `outlet` |
| customer_rating | smallint | 1–5, nullable |
| customer_feedback_text | text | nullable |
| driver_rating | smallint | 1–5, nullable |
| driver_feedback_text | text | nullable |
| rated_at | timestamptz | |
| requested_at | timestamptz | when customer submitted |
| accepted_at | timestamptz | |
| arriving_at | timestamptz | driver marked arriving |
| started_at | timestamptz | ride begins |
| completed_at | timestamptz | |
| cancelled_at | timestamptz | |
| cancelled_by | uuid | FK → users, nullable |
| cancellation_reason | text | |
| created_at | timestamptz | |

**Pricing snapshot:** When a ride is created, the active `pricing_rules` row is serialized into `pricing_snapshot_json`. All fare calculations and dispute resolution reference this snapshot, never the current pricing rule.

---

#### `ride_status_history`

Full audit trail. Every status transition is recorded.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| ride_id | uuid | FK → rides |
| old_status | enum | |
| new_status | enum | |
| changed_by_user_id | uuid | nullable (null if system) |
| changed_by_system | boolean | true for auto-transitions (e.g. timeout) |
| created_at | timestamptz | |

---

#### `ride_dispatch_attempts`

Audit trail for the dispatch process. Records every driver contacted for a ride and their response.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| ride_id | uuid | FK → rides |
| driver_id | uuid | FK → drivers |
| attempt_no | int | sequential per ride |
| sent_at | timestamptz | when request was pushed |
| responded_at | timestamptz | nullable |
| response | enum | `accepted` / `declined` / `timeout` |
| triggered_by | enum | `system` / `admin` |
| timeout_seconds | int | default 30 |

---

#### `driver_locations`

Time-series GPS data for live tracking and historical route reconstruction.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| driver_id | uuid | FK → drivers |
| ride_id | uuid | FK → rides, nullable (tracked even when idle) |
| lat | decimal | |
| lng | decimal | |
| heading | decimal | degrees, 0–360 |
| speed | decimal | km/h |
| recorded_at | timestamptz | device timestamp |

---

#### `messages`

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| ride_id | uuid | FK → rides |
| sender_id | uuid | FK → users |
| message_type | enum | `text` / `system` |
| body | text | |
| read_at | timestamptz | nullable |
| created_at | timestamptz | |

`system` type used for automated messages (e.g. "Driver is arriving", "Ride completed").

---

#### `payments`

Event-based ledger supporting partial captures, refunds, and failure tracking.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| ride_id | uuid | FK → rides |
| provider | varchar | `stripe` |
| stripe_payment_intent_id | varchar | |
| amount | decimal | authorized amount |
| captured_amount | decimal | actual charge |
| refunded_amount | decimal | 0 if none |
| currency | varchar | `EUR` |
| payment_method_type | varchar | `card` / `apple_pay` / `google_pay` |
| status | enum | `pending` / `authorized` / `captured` / `refunded` / `failed` |
| failure_reason | text | nullable |
| paid_at | timestamptz | |
| webhook_event_id | varchar | Stripe event ID for idempotency |
| metadata_json | jsonb | |
| created_at | timestamptz | |

---

#### `pricing_rules`

Configurable by admin. Supports time-based windows and vehicle-type multipliers.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| base_fare | decimal | EUR |
| per_km | decimal | EUR |
| per_minute | decimal | EUR |
| night_surcharge_pct | decimal | e.g. 20.0 for 20% |
| minimum_fare | decimal | floor price |
| cancellation_fee | decimal | charged on late cancellations |
| reservation_fee | decimal | extra for scheduled rides |
| vehicle_type_multiplier | jsonb | e.g. `{"standard": 1.0, "monovolume": 1.3}` |
| time_window | tstzrange | when this rule applies (null = default) |
| updated_by | uuid | FK → users |
| updated_at | timestamptz | |

---

#### `zones`

Geographic zones for fixed-route pricing and service area boundaries.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | varchar | e.g. "Recanati Centro" |
| city | varchar | e.g. "Recanati" |
| polygon | geometry(Polygon, 4326) | PostGIS polygon |
| active | boolean | |

Zone containment queries use `ST_Contains(zones.polygon, point)`. Nearest-driver queries use `ST_DWithin` on `drivers.current_lat/current_lng`.

---

#### `fixed_routes`

Predefined routes with fixed pricing that override calculated fares.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | varchar | e.g. "Recanati → Ancona Airport" |
| origin_zone_id | uuid | FK → zones |
| destination_zone_id | uuid | FK → zones |
| min_price | decimal | |
| max_price | decimal | |

---

#### `push_tokens`

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| token | varchar | Expo push token |
| platform | enum | `ios` / `android` |

---

#### `admin_actions`

Audit log for all admin operations.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| admin_user_id | uuid | FK → users |
| action_type | varchar | e.g. `dispatch_override`, `pricing_update`, `driver_suspend` |
| entity_type | varchar | e.g. `ride`, `driver`, `pricing_rules` |
| entity_id | uuid | |
| payload_json | jsonb | before/after snapshot |
| created_at | timestamptz | |

---

### 2 — API Structure

All endpoints require JWT authentication. Admin endpoints require `role = admin`. Rate-limited per user.

- **`/api/auth/*`** — Registration, login (phone OTP, email/password, Google, Apple), token refresh, logout, GDPR data export, account deletion
- **`/api/rides/*`** — Create ride, get fare estimate, accept, decline, update status, cancel, rate, ride history, active ride details
- **`/api/drivers/*`** — Update status (available/offline/paused), push GPS location, get earnings (daily/weekly/monthly), get schedule, update profile and vehicle info
- **`/api/admin/*`** — Dashboard stats, manual dispatch, manage drivers (CRUD, verify, suspend), pricing rules CRUD, zone management, revenue reports, audit log viewer
- **`/api/messages/*`** — Send message, list messages by ride, mark as read
- **`/api/payments/*`** — Create payment intent, confirm payment, Stripe webhook handler, refund
- **`/api/tours/*`** — List tour categories, get tour details, book tour

---

### 3 — Real-Time (Socket.io)

#### Socket Rooms

| Room | Subscribers | Purpose |
|------|------------|---------|
| `ride:{ride_id}` | Customer + assigned driver | GPS updates, status changes, chat messages |
| `driver:{driver_id}` | Individual driver | Incoming ride requests, dispatch assignments |
| `admin` | David (admin users) | All ride statuses, all driver locations, dashboard live stats |

#### Events

| Event | Direction | Payload | Frequency |
|-------|-----------|---------|-----------|
| `driver:location` | Driver → Server → Room | lat, lng, heading, speed | Every 5s during active ride |
| `ride:status` | Server → Room | ride_id, old_status, new_status | On transition |
| `ride:request` | Server → Driver | ride details, fare, timeout | On new ride or dispatch |
| `chat:message` | Bidirectional | message object | On send |
| `admin:update` | Server → Admin | aggregate stats | Every 10s |

#### Reliability

- **Reconnect:** Exponential backoff starting at 1s, max 30s, with jitter
- **Missed events:** On reconnect, client sends last-seen event timestamp; server replays missed events from `ride_status_history` and `messages`
- **Heartbeat:** 25s interval, 10s timeout for disconnect detection

---

### 4 — Core Backend Logic

#### Auto-Assign Dispatch

1. Customer requests an immediate ride
2. Server runs a PostGIS nearest-driver query: `ST_DWithin` on `drivers.current_lat/current_lng` filtered by `drivers.status = 'available'` and `drivers.last_location_at` within 60 seconds, ordered by `ST_Distance`, limited to a configurable radius (default 15 km)
3. First result receives the ride request via `ride:request` event with a 30-second timeout
4. If the driver declines or times out, the attempt is logged to `ride_dispatch_attempts` and the next nearest driver is contacted
5. After all drivers in radius are exhausted, the ride status moves to `expired` and the customer is notified
6. Admin override: David can manually assign any ride to any driver at any time via the dispatch screen, bypassing auto-assign. Logged to `admin_actions`

#### Fare Estimation

1. Pickup and destination coordinates are sent to Google Maps Distance Matrix API to get `distance_meters` and `duration_seconds`
2. Server checks if pickup and destination fall within any `fixed_routes` zones (`ST_Contains` on `zones.polygon`). If a fixed route matches, its price range is returned
3. Otherwise, the active `pricing_rules` row is applied: `base_fare + (per_km * distance) + (per_minute * duration)`, with `night_surcharge_pct` applied between 22:00–06:00, `vehicle_type_multiplier` per vehicle, and `minimum_fare` enforced as floor
4. The full pricing rule is serialized into `rides.pricing_snapshot_json` at booking time

#### Push Notifications

Delivered via Expo Push Notification Service:

- New ride request → driver (sound + vibration)
- Ride accepted / driver arriving → customer
- Ride status changes → both parties
- New chat message → recipient (if app is backgrounded)
- Reservation reminders → customer (1h before) + driver (30m before)
- Ride completed + payment receipt → customer

#### i18n

All user-facing strings served in Italian (default) or English, based on `users.language`. API responses include localized strings. Push notification content is localized per recipient. Tour descriptions stored in both languages.

#### Concurrency & Transaction Safety

All ride state mutations are protected against race conditions between concurrent driver acceptance, admin dispatch override, and automatic dispatch retries.

- **Ride acceptance** executes inside a database transaction. The ride row is locked with `SELECT ... FOR UPDATE` before checking status and assigning a driver. This prevents multiple drivers from accepting the same ride simultaneously.
- **Admin manual override** acquires the same row-level lock. If a driver acceptance transaction is already in progress, the admin override waits or fails gracefully with a conflict response.
- **Status transitions** are atomic: the `rides.status` update and the `ride_status_history` insert occur in the same transaction. No partial state changes are possible.
- **Payment capture and ride completion** are transactional: `rides.status → completed`, `rides.fare_final` write, and `payments.status → captured` occur in a single transaction. If Stripe capture fails, the ride remains `in_progress` and the driver is notified to retry or collect payment in person.
- **Dispatch retry** checks the ride is still `pending` before contacting the next driver. If the ride was cancelled or manually assigned during the timeout window, the retry is skipped.

---

### 5 — Ride State Machine

```
pending → accepted → arriving → in_progress → completed
```

#### Allowed Transitions

| From | To | Triggered By |
|------|----|-------------|
| `pending` | `accepted` | Driver accepts or admin assigns |
| `pending` | `cancelled` | Customer cancels before acceptance |
| `pending` | `expired` | All dispatch attempts exhausted |
| `accepted` | `arriving` | Driver marks en route to pickup |
| `accepted` | `cancelled` | Customer or driver cancels (cancellation fee may apply) |
| `arriving` | `in_progress` | Driver confirms customer picked up |
| `arriving` | `cancelled` | Customer cancels (cancellation fee applies) |
| `arriving` | `no_show` | Driver marks customer not present after wait period |
| `in_progress` | `completed` | Driver marks ride finished; payment captured |

#### Rules

- Every transition writes a row to `ride_status_history`
- No skipping states (e.g. `pending` cannot go directly to `in_progress`)
- `completed`, `cancelled`, `expired`, and `no_show` are terminal states
- `cancelled_by` and `cancellation_reason` are required on cancellation transitions
- `no_show` triggers cancellation fee via `pricing_rules.cancellation_fee`

---

### 6 — Data Retention & Compliance

- **Driver GPS history** (`driver_locations`): retained for 90 days. Older records are purged via scheduled job. Route summaries (distance, duration) persist on the `rides` row indefinitely.
- **Ride chat** (`messages`): retained for 180 days. Older messages are deleted; ride metadata is preserved.
- **Payment records** (`payments`): retained according to Italian fiscal law (minimum 10 years for tax-relevant records).
- **Account deletion:** When a user requests account deletion, personal data (name, email, phone, avatar) is anonymized. Ride history and payment records are retained with anonymized references to satisfy legal and financial obligations.
- **GDPR compliance:** The API exposes `/api/auth/export-data` (full user data export as JSON) and `/api/auth/delete-account` (triggers anonymization flow). Both endpoints require re-authentication.
