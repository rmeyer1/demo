---

## `/docs/specs/rest-api-spec.md`

```md
# REST API Specification

This document defines the REST API surface for the Texas Hold'em Home Game platform.

- Base URL (example): `https://api.yourpokerapp.com`
- All endpoints, except health checks, require **Supabase JWT** authentication.

Auth flow:

- Frontend obtains tokens directly from Supabase (via `@supabase/supabase-js`).
- Backend verifies the Supabase JWT on each request:
  - Uses `SUPABASE_JWT_SECRET` and/or JWKS.

---

## 1. Conventions

- **Authentication**
  - Use `Authorization: Bearer <access_token>` header.
- **Content Type**
  - `Content-Type: application/json` for JSON bodies.
- **Error Format**
  - All errors follow:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
````

* **IDs**

  * Use UUIDs for all entities (`tableId`, `handId`, etc.).

---

## 2. Health & Utility

### 2.1 `GET /api/health`

**Description:**
Basic liveness/readiness check.

**Auth:**
No auth required.

**Response 200:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345
}
```

---

## 3. Auth & Profile

> Note: User registration/login is handled via **Supabase Auth** on the frontend.
> The backend only needs to:
>
> * Validate tokens
> * Expose a `/me` endpoint to fetch profile and identity.

### 3.1 `GET /api/auth/me`

**Description:**
Returns the authenticated user’s profile.

**Auth:**
Required (Supabase JWT).

**Response 200:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "displayName": "Rob",
  "createdAt": "2025-11-16T19:32:00Z"
}
```

**Response 401:**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid token."
  }
}
```

---

## 4. Tables & Lobby

### 4.1 `POST /api/tables`

**Description:**
Create a new poker table hosted by the current user.

**Auth:**
Required.

**Request Body:**

```json
{
  "name": "Friday Night Home Game",
  "maxPlayers": 6,
  "smallBlind": 10,
  "bigBlind": 20
}
```

**Validations:**

* `name`: non-empty string
* `maxPlayers`: integer between 2 and 9
* `smallBlind > 0`, `bigBlind > smallBlind`

**Response 201:**

```json
{
  "id": "table-uuid",
  "hostUserId": "user-uuid",
  "name": "Friday Night Home Game",
  "inviteCode": "FRI-123",
  "maxPlayers": 6,
  "smallBlind": 10,
  "bigBlind": 20,
  "status": "OPEN",
  "createdAt": "2025-11-16T19:32:00Z"
}
```

---

### 4.2 `GET /api/tables/:id`

**Description:**
Fetch table details and current seat assignments (not realtime gameplay state).

**Auth:**
Required.

**Response 200:**

```json
{
  "id": "table-uuid",
  "hostUserId": "user-uuid",
  "name": "Friday Night Home Game",
  "inviteCode": "FRI-123",
  "maxPlayers": 6,
  "smallBlind": 10,
  "bigBlind": 20,
  "status": "OPEN",
  "createdAt": "2025-11-16T19:32:00Z",
  "seats": [
    {
      "seatIndex": 0,
      "userId": "user-uuid-1",
      "displayName": "Alice",
      "stack": 2000,
      "isSittingOut": false
    },
    {
      "seatIndex": 1,
      "userId": "user-uuid-2",
      "displayName": "Bob",
      "stack": 2000,
      "isSittingOut": false
    }
  ]
}
```

**Response 404:**

```json
{
  "error": {
    "code": "TABLE_NOT_FOUND",
    "message": "Table does not exist."
  }
}
```

---

### 4.3 `GET /api/my-tables`

**Description:**
List tables that the user hosts or has recently joined.

**Auth:**
Required.

**Query Params (optional):**

* `limit` (default 20)
* `offset` (default 0)

**Response 200:**

```json
[
  {
    "id": "table-uuid-1",
    "name": "Friday Night Home Game",
    "status": "IN_GAME",
    "maxPlayers": 6,
    "smallBlind": 10,
    "bigBlind": 20,
    "hostUserId": "user-uuid",
    "createdAt": "2025-11-10T18:00:00Z"
  },
  {
    "id": "table-uuid-2",
    "name": "Casual Heads-Up",
    "status": "OPEN",
    "maxPlayers": 2,
    "smallBlind": 5,
    "bigBlind": 10,
    "hostUserId": "other-user-uuid",
    "createdAt": "2025-11-12T20:30:00Z"
  }
]
```

---

### 4.4 `POST /api/tables/join-by-code`

**Description:**
Join a table given an `inviteCode`. Does **not** seat the user; just marks them as a participant authorized to open `/table/:id`.

**Auth:**
Required.

**Request Body:**

```json
{
  "inviteCode": "FRI-123"
}
```

**Response 200:**

```json
{
  "tableId": "table-uuid",
  "name": "Friday Night Home Game",
  "maxPlayers": 6,
  "status": "OPEN"
}
```

**Response 404:**

```json
{
  "error": {
    "code": "TABLE_NOT_FOUND",
    "message": "Invalid invite code."
  }
}
```

---

## 5. Seats & Buy-in

> Note: Seat actions during an active hand are generally coordinated through WebSockets.
> This REST interface is primarily for initial seating / pre-game join.

### 5.1 `POST /api/tables/:id/sit-down`

**Description:**
Seat the user at a specific seat index and set initial stack (buy-in).

**Auth:**
Required.

**Request Body:**

```json
{
  "seatIndex": 3,
  "buyInAmount": 2000
}
```

**Rules:**

* `seatIndex` must exist for that table.
* Seat must not be occupied.
* `buyInAmount` > 0 and within allowed range (configurable later).

**Response 200:**

```json
{
  "tableId": "table-uuid",
  "seatIndex": 3,
  "userId": "user-uuid",
  "displayName": "Rob",
  "stack": 2000,
  "isSittingOut": false
}
```

**Possible Errors:**

* `SEAT_TAKEN`
* `INVALID_SEAT`
* `INVALID_BUYIN`

---

### 5.2 `POST /api/tables/:id/stand-up`

**Description:**
User leaves their seat (if allowed), potentially cashing out remaining stack.

**Auth:**
Required.

**Request Body:** *(optional or empty)*

```json
{}
```

**Response 200:**

```json
{
  "tableId": "table-uuid",
  "seatIndex": 3,
  "remainingStack": 1500
}
```

**Rules / Timing:**

* Allowed when the player is **not in the current hand** (already folded or the hand is complete).
* If attempted while still active in a hand, return `HAND_IN_PROGRESS` (future alternative: mark `SITTING_OUT` and defer unseat to hand end).
* Successful call clears the seat; remaining stack is returned to the caller’s balance (or kept virtually off-table).

**Errors:**

* `NOT_SEATED`
* `HAND_IN_PROGRESS`

### 5.3 Disconnect / reconnect (informational)

* When a player disconnects during a hand, the server marks the seat `SITTING_OUT` but keeps the seat and chips in place.
* If that stack reaches **0**, the seat may be auto-unseated without an explicit stand-up call.
* On reconnect, the client should re-send `JOIN_TABLE` over WebSocket; the server restores seat state in `TABLE_STATE`.

---

## 6. Chat API

Realtime chat is handled over WebSockets, but the REST API provides **history**.

### 6.1 `GET /api/tables/:id/chat`

**Description:**
Fetch recent chat messages for a table.

**Auth:**
Required, and user must be allowed to view the table.

**Query Params:**

* `limit`: integer (default 50, max 200)
* `before`: ISO timestamp or message id (optional, for pagination)

**Response 200:**

```json
[
  {
    "id": "msg-uuid-1",
    "userId": "user-uuid-1",
    "displayName": "Alice",
    "seatIndex": 0,
    "content": "Good luck everyone!",
    "createdAt": "2025-11-16T20:00:01Z"
  },
  {
    "id": "msg-uuid-2",
    "userId": "user-uuid-2",
    "displayName": "Bob",
    "seatIndex": 1,
    "content": "GLGL",
    "createdAt": "2025-11-16T20:00:05Z"
  }
]
```

---

## 7. Dashboard (Metrics)

### 7.1 `GET /api/dashboard/summary`

**Description:**
Fetch aggregated performance metrics for the authenticated user.

**Auth:**
Required.

**Query Params (optional):**

* `range`: `"lifetime" | "7d" | "30d"`
  (default: `lifetime`)

**Response 200:**

```json
{
  "range": "30d",
  "totalHands": 320,
  "netChips": 1450,
  "vpip": 0.32,
  "pfr": 0.18,
  "showdownWinPct": 0.56,
  "bbPer100": 3.4
}
```

---

### 7.2 `GET /api/dashboard/progression`

**Description:**
Fetch a timeseries of net chips over time or hand index.

**Auth:**
Required.

**Query Params (optional):**

* `range`: `"lifetime" | "7d" | "30d"` (default: `lifetime`)
* `groupBy`: `"day" | "hand"` (default: `"day"`)

**Response 200 (groupBy = day):**

```json
{
  "range": "30d",
  "points": [
    { "date": "2025-11-01", "netChips": -200 },
    { "date": "2025-11-02", "netChips": 150 },
    { "date": "2025-11-03", "netChips": 300 }
  ]
}
```

**Response 200 (groupBy = hand):**

```json
{
  "range": "7d",
  "points": [
    { "handNumber": 1, "netChips": 20 },
    { "handNumber": 2, "netChips": -40 },
    { "handNumber": 3, "netChips": 100 }
  ]
}
```

---

## 8. Optional: Hand History Endpoint (Future)

You may later expose an endpoint like:

### `GET /api/hands/:id`

To fetch detailed hand info (board, actions, players, showdown results) for replays.

---

## 9. Responsibilities Split (REST vs WebSocket)

* **REST**:

  * Auth introspection (`/auth/me`)
  * Lobby & table metadata
  * Initial seating / standing
  * Chat history
  * Dashboard metrics
* **WebSockets**:

  * Table join and leave events
  * Realtime seat changes during play
  * All gameplay actions (betting, dealing, showdown)
  * Realtime chat messages
  * Realtime table state updates

REST must never try to replicate game loop logic — that stays in the WebSocket + engine layer.

---

## 10. Versioning

* Initial version is `v1`, with routes under `/api/`.
* If breaking changes are introduced, consider namespacing:

  * `/api/v2/...`

---

This spec is the authoritative contract for REST endpoints used by the frontend and any external clients.
For realtime protocols, see `/docs/specs/websocket-protocol.md`.
