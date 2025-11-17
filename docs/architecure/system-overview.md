# `/docs/architecture/system-overview.md`

```md
# System Overview

This document provides a complete **high-level overview** of the entire Texas Hold’em Home Game Platform.  
It describes the architecture, major subsystems, data flow, and the overall responsibilities of each component.

For detailed module specifications, see:

- Backend Architecture: `/docs/architecture/backend-overview.md`
- Frontend Architecture: `/docs/architecture/frontend-overview.md`
- Game Engine Spec: `/docs/specs/game-engine-spec.md`
- REST API Spec: `/docs/specs/rest-api-spec.md`
- WebSocket Protocol: `/docs/specs/websocket-protocol.md`
- Chat System Spec: `/docs/specs/chat-system-spec.md`

---

# 1. System Goals

The platform enables users to:

- Create private Texas Hold’em poker rooms
- Invite friends via an invite code
- Sit down, buy in, and play online poker in real-time
- Use an integrated text chat during games
- Review personal gameplay performance via dashboards and metrics
- Enjoy a responsive, smooth poker experience on mobile and desktop

The system prioritizes:

- **Security** — server-authoritative gameplay, no client-side trust
- **Scalability** — table state in Redis + horizontal backend scaling
- **Real-time UX** — WebSocket-based updates
- **Extensibility** — modular design, future new games or features
- **Maintainability** — clear separation of REST, WS, game engine, and data persistence

---

# 2. High-Level Architecture

```

```
                 ┌───────────────────────────────┐
                 │          Frontend (UI)         │
                 │  Next.js + React + Tailwind    │
                 │  REST + WebSocket client       │
                 └───────────────┬────────────────┘
                                 │ HTTPS / WSS
                                 ▼
                 ┌────────────────────────────────────┐
                 │         Backend (Node.js)           │
                 │ REST API + WebSocket Gateway        │
                 │ Game Service + Metrics Service      │
                 └──────────────┬───────────┬─────────┘
                                │           │
                        Prisma  │           │  Redis Pub/Sub
                                │           │
                     ┌──────────▼─┐     ┌──▼────────────┐
                     │Supabase DB │     │ Redis Cache    │
                     │(Postgres)  │     │(Table State)   │
                     └────────────┘     └───────────────┘
```

```

---

# 3. Major Subsystems

The platform consists of the following core subsystems:

- **Frontend Application (Next.js)**
- **Backend API (REST)**
- **WebSocket Gateway**
- **Game Engine**
- **Database (Supabase Postgres)**
- **Redis (Cache + Coordination)**
- **Metrics & Analytics**
- **Chat System**

Each is described below.

---

# 4. Frontend Application

### Technologies
- Next.js (App Router, TypeScript)
- Tailwind CSS
- React Query or SWR for REST data
- WebSocket client for realtime gameplay + chat

### Responsibilities
- UI rendering for:
  - Lobby
  - Table gameplay
  - Dashboard/metrics
  - Auth flows
- Managing local UI state
- Calling REST endpoints for:
  - Table metadata
  - Chat history
  - Dashboard metrics
- Connecting to WebSocket server for:
  - Realtime gameplay
  - Action updates
  - Chat messages

The frontend **never** handles game logic — it only consumes authoritative state updates.

---

# 5. Backend (REST API)

### Technologies
- Node.js + TypeScript
- Fastify, Express, or NestJS
- Prisma ORM

### Responsibilities
- User introspection (`/auth/me`)
- Table CRUD and lobby functionality
- Seat/buy-in actions
- Chat history endpoints
- Dashboard metrics aggregation
- Authentication using Supabase JWT validation
- Persistence of:
  - Hands
  - Player hands
  - Actions
  - Chat messages

REST API does not handle real-time gameplay, which is handled via WebSockets.

---

# 6. Backend (WebSocket Gateway)

### Technologies
- `ws` or Socket.IO
- JWT authentication middleware (Supabase JWT)
- Redis pub/sub adapter for scaling

### Responsibilities
- Manage WebSocket connections
- Authenticate via Supabase JWTs
- Enforce table membership
- Route incoming actions to:
  - Game Service
  - Chat Service
- Broadcast outgoing:
  - Table state updates
  - Player actions
  - Dealing events (hole cards)
  - Hand results
  - Chat messages

The WebSocket Gateway contains **no game logic**.

---

# 7. Game Engine

### Technologies
- Pure TypeScript module
- No external dependencies
- Functional, side-effect-free design

### Responsibilities
- Manage `TableState` and `HandState`
- Shuffle, deal, burn, reveal cards
- Validate all betting actions
- Enforce turn order
- Create side pots
- Evaluate hands
- Compute winners
- Produce engine events for UI broadcasting

The engine is the **source of truth** for all poker logic.

---

# 8. Supabase (Postgres)

### Responsibilities
- Store:
  - User profiles
  - Tables and seats
  - Hand and action data
  - Chat messages
- Provide Supabase Auth:
  - Email/password
  - Social login (optional)
  - JWT for backend authorization
- Handle backups and reliability

Database schema defined in:  
`/docs/architecture/database-schema.md`

---

# 9. Redis (State + Coordination)

### Responsibilities
- Cache `TableState` for fast gameplay actions
- Provide pub/sub channels for:
  - Multi-instance WebSocket broadcasting
  - Coordinating table updates across backend instances
- Optional turn timers and rate-limits

Redis key conventions:

- `table:state:<tableId>`
- `table:events:<tableId>` (pub/sub)
- `table:locks:<tableId>` (optional optimistic locking)

---

# 10. Metrics & Analytics

Using the `hands`, `player_hands`, and `hand_actions` tables:

- Compute:
  - VPIP
  - PFR
  - Showdown %
  - Net chips
  - BB/100
  - Hand histories
- API endpoints:
  - `/api/dashboard/summary`
  - `/api/dashboard/progression`

---

# 11. Chat System

Chat system is multi-layer:

- WebSocket for realtime messages
- REST for chat history
- Supabase DB for storage
- Redis not required for chat (optional for scaling)

Full details in:  
`/docs/specs/chat-system-spec.md`

---

# 12. Security Model

### Key Principles
- Clients cannot manipulate game state.
- Only server holds:
  - Deck order  
  - All players’ hole cards  
  - Betting and pot logic  
- JWT-based auth prevents impersonation.
- WebSocket gateway validates all actions using userId derived from JWT.
- Redis & Postgres ensure consistency even across multiple backend instances.

### Sensitive Information Never Exposed
- Other players' hole cards
- Deck state/order
- Backend-derived evaluations until showdown

---

# 13. Scalability Strategy

### Backend Instances
- Run multiple Node.js instances behind a load balancer
- Use Redis pub/sub + shared state to synchronize table events

### Database Scaling
- Supabase supports vertical and horizontal scaling
- Write operations are minimal per hand (only at end of street/hand)

### WebSocket Scaling
- Sticky sessions or Socket.IO Redis adapter
- Stateless backend instances

---

# 14. Data Flow Summary

### Gameplay
1. Player performs action → WS `PLAYER_ACTION`
2. Backend loads table state → engine updates → backend persists
3. Backend broadcasts updated table state → clients re-render

### Chat
1. Client → WS `CHAT_SEND`
2. Backend validates + persists message
3. Backend broadcasts `CHAT_MESSAGE`

### Dashboard
1. Frontend requests metrics via REST
2. Backend queries aggregated stats
3. Frontend renders charts

---

# 15. Non-Goals (V1)

- No video/audio chat
- No real money support
- No multi-game support (Texas Hold’em only)
- No tournament mode
- No side games or casino utilities
- No offline mode

---

# 16. Summary

The system architecture is built for:

- High performance
- Clean separation of responsibilities
- Long-term scalability
- Strict server-authoritative poker rules
- Smooth real-time user experience

This overview should be used as a top-level reference for all teams and agents implementing parts of the system.
```