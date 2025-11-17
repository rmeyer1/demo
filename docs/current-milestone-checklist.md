# Current Milestone Checklist

Trackable, card-ready milestones aligned with architecture/specs.

## 1) Backend Environment & Data Foundations
- Add `.env.example` (root + backend) with Supabase/Redis vars; one-command local bootstrap per `/docs/setup/environment-setup.md`.
- Verify Prisma schema matches `/docs/architecure/database-schema.md`; run `prisma migrate dev` and commit artifacts.
- Seed script for two demo users + one table to accelerate E2E.

## 2) WebSocket Contract Alignment
- Emit protocol-specific events (`TABLE_STATE`, `ACTION_TAKEN`, `HAND_RESULT`, `CHAT_MESSAGE`, etc.) instead of a generic `message` envelope in `backend/src/ws/table.handler.ts`.
- Add zod schemas for all WS payloads (join, sit, action, chat); return spec error codes.
- Update `frontend/hooks/useWebSocket` and `useTableState` to subscribe to discrete events and drop manual type routing.

## 3) Gameplay Loop Orchestration
- Auto-start a hand when ≥2 seated players with chips (timer or explicit trigger) via `game.service.startHand`.
- Initialize Redis state from DB correctly for resumed tables; ensure dealer/button rotation.
- Add hand timer/turn-timeout stub (auto-fold) for production hardening.

## 4) Persistence & Metrics Hardening
- Finish `persistHandToDb` parity with spec: write all `hand_actions`, store `communityCards`, `finalStacks`, correct `vpip_flag/pfr_flag`.
- Optimize dashboard queries (range filters, bb/100 normalization) and add unit tests in `metrics.service`.
- Ensure Prisma includes required indexes from `/docs/architecure/database-schema.md`.

## 5) Auth & Membership Guardrails (REST/WS)
- Enforce membership/host checks across REST (`tables.controller`) and WS handlers; return spec error codes (`NOT_IN_TABLE`, `INVALID_SEAT`, etc.).
- Add rate limits for chat + actions (configurable); standardized error responses.

## 6) Frontend Auth & Lobby Flows
- Build `/auth/login` and `/auth/register` using Supabase client.
- Implement `/lobby`: list “My Tables”, create table modal, join-by-code flow (REST).
- Wire React Query provider globally; align `apiClient` typing.

## 7) Table Page & Gameplay UI
- Implement `/table/[id]` with `PokerTable`, `PlayerSeat`, `ActionControls`, `TableHud`, `PotDisplay`; bind to WS events and REST snapshot.
- Align FE types (`frontend/lib/types.ts`) with backend public table view (seat status, pots, street, call/min bet).
- Send `PLAYER_ACTION` with client validation; show `HAND_RESULT` overlays and turn/stack updates.

## 8) Chat Integration
- Hook `ChatPanel` to WS `CHAT_MESSAGE` and REST history (`GET /api/tables/:id/chat`); enforce 256-char limit client-side; render timestamps/seat labels.
- UX for chat rate-limit / invalid-content errors.

## 9) Dashboard Page
- Implement `/dashboard` consuming `GET /api/dashboard/summary` and `.../progression`; render `StatsSummary` + `NetChipsChart` with range selector (Lifetime/30d/7d).
- Handle loading/error/empty states.

## 10) Testing & CI Enablement
- Stand up Vitest suites per `/docs/testing/*`: engine, services, REST, WS; add Playwright API + browser specs (auth → lobby → table → dashboard happy paths).
- Provide deterministic test fixtures (seeded deck or mock engine) for stable E2E.
- Add CI workflow running lint + unit + integration + E2E on PRs.

## 11) Observability & Ops Readiness
- Add structured logging & request tracing (correlation id) across REST/WS; expose `/api/health` in monitoring.
- Wire Redis pub/sub adapter for multi-instance Socket.IO; document sticky-session requirement in deploy notes.
