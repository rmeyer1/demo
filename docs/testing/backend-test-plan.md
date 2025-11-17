## `/docs/testing/backend-test-plan.md`

```md
# Backend Test Plan (REST + WebSocket)

This document defines the **backend test plan** for:

- REST APIs
- WebSocket gateway
- Services (game, chat, metrics)

Tools:

- **Vitest** for unit tests (services, helpers)
- **Playwright (APIRequestContext + WS)** for integration tests

---

## 1. Scope

We test:

- Auth & profile endpoints
- Table & lobby endpoints
- Chat history endpoint
- Dashboard metrics endpoints
- WebSocket auth
- Table join/leave
- Player actions via WS
- Chat messages via WS

---

## 2. Unit Tests (Vitest)

Location:

```txt
/backend/tests/unit/services/
  auth.service.test.ts
  table.service.test.ts
  game.service.test.ts
  chat.service.test.ts
  metrics.service.test.ts
````

### 2.1 Auth Service

* Validate token parsing and mapping to user id.
* Behavior on invalid/expired tokens.
* Mapping Supabase payload into internal `UserContext`.

### 2.2 Table Service

* Creating tables:

  * Valid config → success.
  * Invalid config (blinds, maxPlayers) → errors.
* Fetching by id / invite code.
* Enforcing host ownership for updates.

### 2.3 Game Service

* Given a `TableState`, when `PLAYER_ACTION` arrives:

  * Calls game engine functions.
  * Updates Redis state.
  * Emits correct internal events.
* On `HAND_COMPLETED` event:

  * Saves `Hand`, `PlayerHand` rows.
  * Updates stacks.

Use mocks for Prisma, Redis, and engine.

### 2.4 Chat Service

* Validates chat content length and non-empty strings.
* Applies rate limits (if implemented).
* Stores message in DB.
* Returns fully populated message object.

### 2.5 Metrics Service

* Given synthetic `player_hands`, metrics calculations (VPIP, PFR, BB/100) match expected.

---

## 3. Integration Tests – REST (Playwright API)

Use Playwright’s `request` fixture to hit the running backend.

Directory:

```txt
/backend/tests/integration/api/
  auth.api.spec.ts
  tables.api.spec.ts
  chat.api.spec.ts
  dashboard.api.spec.ts
```

### 3.1 Auth API

* `GET /api/auth/me`:

  * With valid Supabase token → 200 + correct profile body.
  * Without token → 401.
  * With invalid token → 401.

### 3.2 Tables API

* `POST /api/tables`:

  * Valid payload → 201, table created.
  * Missing name or invalid blinds → 400.
* `GET /api/tables/:id`:

  * Existing table → 200.
  * Non-existing id → 404.
* `GET /api/my-tables`:

  * Returns tables user hosts or joined.

### 3.3 Chat API

* `GET /api/tables/:id/chat`:

  * Returns paginated messages.
  * Obeys `limit` param.
  * Requires auth and table membership.

### 3.4 Dashboard API

* `GET /api/dashboard/summary`:

  * With synthetic `player_hands` → metrics match known values.
* `GET /api/dashboard/progression`:

  * `groupBy=day` → chronological points.
  * `groupBy=hand` → per-hand cumulative net.

---

## 4. Integration Tests – WebSocket (Playwright / Node WS)

Directory:

```txt
/backend/tests/integration/websocket/
  ws-auth.spec.ts
  ws-table-flow.spec.ts
  ws-chat.spec.ts
```

### 4.1 WS Auth & Connection

* Connect WS with valid token:

  * Expect `CONNECTED` or ability to `JOIN_TABLE` successfully.
* Connect WS without token:

  * Expect connection refused or `ERROR: UNAUTHORIZED`.
* Connect WS with invalid token:

  * Same as above.

### 4.2 Table Join / Leave / Basic Flow

Flow:

1. Create table via REST.
2. Connect WS as player A.
3. Send `JOIN_TABLE`:

   * Receive `TABLE_JOINED`.
   * Receive initial `TABLE_STATE`.
4. Send `SIT_DOWN`:

   * Table state updated with seat assigned.
5. Optional: Send `STAND_UP`:

   * Seat removed or marked sitting out.

### 4.3 Chat via WebSocket

Flow:

1. Join table via WS.
2. Send `CHAT_SEND` with valid content:

   * Receive `CHAT_MESSAGE`.
   * Check message persisted in DB (via REST `GET /chat`).
3. Send overly long message:

   * Receive `ERROR: CHAT_INVALID`.
4. Send messages too quickly:

   * Receive `ERROR: CHAT_RATE_LIMIT` (if implemented).

---

## 5. Game Actions via WebSocket (Integration)

Using WS test client (Node or Playwright page):

Scenarios:

* Preflop action:

  * After `startHand` triggered, verify:

    * `HOLE_CARDS` goes to player.
    * `TABLE_STATE` indicates correct `toActSeatIndex`.
  * Send `PLAYER_ACTION`:

    * Valid action → `ACTION_TAKEN` + new `TABLE_STATE`.
    * Invalid action → `ERROR: INVALID_ACTION`.

* All-in / showdown scenario:

  * Pre-seed engine or DB with known stacks.
  * Simulate sequence of actions:

    * At end, verify:

      * `HAND_RESULT` event.
      * `TABLE_STATE` stack changes.
      * DB has expected `Hand` and `PlayerHand` rows.

---

## 6. Running Backend Tests

Typical scripts in `/backend/package.json`:

```json
{
  "scripts": {
    "test:unit": "vitest run tests/unit",
    "test:integration": "playwright test backend/tests/integration"
  }
}
```

Integration tests require a **running backend**, connected to a test DB and test Redis.

---

## 7. Data Management

For integration tests:

* Use a **separate test database** (Supabase or local).
* Clean up between tests:

  * Use transactions or truncate relevant tables.
* Seed minimal data:

  * A test user (linked to a valid Supabase token fixture)
  * Optionally pre-created tables/hands.

````