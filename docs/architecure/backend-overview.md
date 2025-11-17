# `/docs/architecture/backend-overview.md`

```md
# Backend Architecture Overview (Node.js + TypeScript + Supabase + Redis)

This document provides a complete, authoritative specification of the backend architecture for the **Texas Hold'em Home Game Platform**.

The backend is responsible for:
- Authentication (via Supabase Auth)
- Lobby & table management
- Game Engine integration (Texas Hold'em rules)
- WebSocket realtime gameplay + chat
- Persistence of hands, chat, metrics
- Dashboard analytics and aggregation

Supabase provides:
- Hosted PostgreSQL
- User authentication + JWTs
- Row-Level Security (optional)
- Realtime DB streams (optional, non-critical)

Redis provides:
- In-memory table state
- Pub/Sub for WebSocket scaling

The backend is deployed as one or multiple stateless Node.js services behind a load balancer.

---

# 1. Backend Technology Stack

| Layer | Technology |
|-------|-------------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Fastify, Express, or NestJS |
| Database | Supabase Postgres (via Prisma) |
| Auth | Supabase Auth (JWT) |
| Realtime Gameplay | Custom WebSocket Server |
| Cache / Coordination | Redis |
| Game Logic | Custom Game Engine Module (pure TypeScript) |
| Testing | Jest or Vitest |

---

# 2. High-Level Architecture

```

```
             ┌─────────────────────────┐
             │       Next.js UI        │
             │ (REST + WebSocket Client)│
             └───────────┬─────────────┘
                         │
               HTTPS / WSS (JWT)
                         │
         ┌───────────────┴────────────────┐
         │        Node Backend API         │
         │     (REST + WebSocket GW)       │
         └───────┬──────────────┬─────────┘
                 │              │
      Prisma ORM │              │ WebSocket Events
                 │              │
   ┌─────────────▼───┐      ┌──▼────────────────┐
   │  Supabase Postgres│      │   Redis           │
   │ (User/Hand/Chat) │      │(table state+pubsub)│
   └──────────────────┘      └────────────────────┘
```

```

---

# 3. Module Structure

Recommended backend folder layout:

```

/backend
/src
/api
auth.controller.ts
tables.controller.ts
dashboard.controller.ts
chat.controller.ts
/ws
websocket-gateway.ts
ws-handlers
table.handler.ts
chat.handler.ts
/engine
index.ts
state-helpers.ts
evaluator.ts
types.ts
/services
auth.service.ts
table.service.ts
game.service.ts
metrics.service.ts
chat.service.ts
/db
prisma.ts
redis.ts
/config
env.ts
logger.ts
server.ts

```

---

# 4. Integration With Supabase

Supabase is used for:

### Authentication
- Users register/login using Supabase Auth via the **frontend**.
- A JWT is issued client-side.
- Backend verifies JWTs using Supabase’s public JWK.

### Database (Postgres)
Supabase provides the Postgres instance, which you treat exactly like any hosted database.

- Backend uses Prisma with:
```

DATABASE_URL="postgres://..."

```
- Prisma migrations run against Supabase.

### Optional: RLS (Row-Level Security)
Disable RLS for most backend tables because:
- All database access is via the backend server
- Backend acts as the single trusted layer

RLS can remain enabled for `User` identity tables if desired.

### Not used for gameplay logic  
Supabase’s realtime features do **not** replace:
- Websocket gameplay layer
- Game engine
- Redis pub/sub

---

# 5. Redis Responsibilities

Redis provides:

### Table State Cache
- `table:state:<tableId>` stores serialized `TableState`
- Fast access for gameplay operations

### Pub/Sub for Distributed WebSocket Events
Required when scaling to multiple backend instances.

### Optional: turn timers & action expiration

---

# 6. WebSocket Gateway

The gateway is responsible for:

### Authenticating WebSocket connections
- Client passes Supabase JWT in connection params
- Backend verifies JWT → extracts userId

### Message routing
Incoming (client → server):
- `JOIN_TABLE`
- `SIT_DOWN`
- `PLAYER_ACTION`
- `CHAT_SEND`

Outgoing (server → clients):
- `TABLE_STATE`
- `HOLE_CARDS`
- `ACTION_TAKEN`
- `HAND_RESULT`
- `CHAT_MESSAGE`
- `ERROR`

### Broadcasting to rooms
Clients join:
- `user:<userId>`
- `table:<tableId>`

---

# 7. Game Service (Orchestrator)

The game service coordinates:
- Redis state load/save
- Calling game engine functions
- Persisting results to Supabase
- Broadcasting events through WebSockets

Flow example (user calls, engine updates state):

```

client → WebSocket → game.service → engine.applyPlayerAction()
→ engine.advanceIfReady()
→ persist results
→ broadcast new table state

```

---

# 8. Game Engine (Pure TypeScript)

Defined in:

```

/docs/specs/game-engine-spec.md

````

Engine functions:
- `initTableState`
- `seatPlayer`
- `startHand`
- `applyPlayerAction`
- `advanceIfReady`
- `getPublicTableView`

Engine returns:
- New state
- Engine events for broadcasting

Engine has **no side effects**.

---

# 9. Data Persistence (Supabase Postgres)

Tables include:

- `User` (from Supabase Auth)
- `Table`
- `Seat`
- `Hand`
- `PlayerHand`
- `ChatMessage`

Details in `/docs/architecture/database-schema.md`.

---

# 10. Metrics System

Metrics service uses data from:
- `Hand`
- `PlayerHand`

To compute:
- VPIP
- PFR
- Win/loss
- Net chips
- BB/100

Endpoints:
- `GET /api/dashboard/summary`
- `GET /api/dashboard/progression`

---

# 11. Error Handling

Return standardized API errors:
```json
{
  "error": {
    "code": "INVALID_ACTION",
    "message": "It is not your turn."
  }
}
````

WebSocket errors follow analogous structure.

---

# 12. Scalability Considerations

### Horizontal scaling:

* Multiple backend instances
* Redis pub/sub ensures consistent table updates
* WebSocket sticky sessions recommended

### Supabase handles:

* Postgres scaling
* Backups
* Auth performance

---

# 13. Non-Goals

* Not relying on Supabase Realtime for gameplay
* No Supabase Edge Functions for game logic
* No real money support (V1)
* No multi-game support (V1)

---

# 14. Summary

Using Supabase for Auth + Postgres greatly simplifies:

* Authentication
* Schema management
* DB hosting
* Security

While retaining:

* Full control over your game engine
* Custom WebSocket layer
* Redis-driven state management

This hybrid model is the recommended architecture for V1 and beyond.