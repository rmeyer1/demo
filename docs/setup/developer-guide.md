## `/docs/setup/dev-workflow.md`

```md
# Development Workflow Guidelines

This document defines the **standard development workflow** for all agents working on the Texas Hold’em Home Game platform.

The goals are:

- Consistency
- Predictability
- Easy collaboration
- High-quality, testable code

These guidelines apply to **frontend**, **backend**, and **game engine** work.

---

# 1. Branching & Git Workflow

### 1.1 Main Branches

- `main` (or `master`)
  - Always deployable.
  - Only updated via Pull Requests (PRs).
- `develop` (optional)
  - Used if you want a staging branch.
  - Not required for v1; you can work with just `main` + feature branches.

### 1.2 Feature Branch Naming

Use descriptive branch names:

- `feature/game-engine-preflop`
- `feature/ws-chat-integration`
- `bugfix/table-state-race-condition`
- `chore/prisma-migrations`

### 1.3 Workflow

1. **Create branch** from `main`:
   ```sh
   git checkout main
   git pull
   git checkout -b feature/<short-description>
````

2. Implement feature.
3. Run tests locally.
4. Commit with clear messages.
5. Push branch and open PR.
6. Address review comments.
7. Merge only after all checks pass.

---

# 2. Commit Messages

Write clear, concise messages that describe **what** changed, not just “fix stuff”.

Recommended formats:

* `feat(engine): add side pot handling`
* `fix(ws): handle invalid PLAYER_ACTION messages`
* `chore(db): add index on player_hands.user_id`
* `docs(api): update dashboard range description`

Avoid:

* `wip`
* `misc changes`
* `fix stuff`

---

# 3. Code Style & Quality

### 3.1 TypeScript

* Always use `strict` mode.
* Prefer explicit types for public functions.
* Avoid `any` unless there’s a very good reason.

### 3.2 Linting & Formatting

* Use ESLint + Prettier.
* Run before commit:

  ```sh
  npm run lint
  npm run format
  ```
* CI should fail on lint errors.

### 3.3 Folder Conventions

* **Backend**

  * `/backend/src/api` for controllers
  * `/backend/src/services` for business logic
  * `/backend/src/engine` for poker logic
  * `/backend/src/ws` for WebSocket handling
* **Frontend**

  * `/frontend/app` for Next.js routes
  * `/frontend/components` for shared UI
  * `/frontend/hooks` for React hooks
  * `/frontend/lib` for API clients and utilities

---

# 4. Engine-First Development (Game Logic)

When implementing or modifying the game engine:

1. **Read the spec**: `/docs/specs/game-engine-spec.md`
2. Start with **types** and **interfaces**.
3. Implement smallest pieces:

   * `createDeck`, `shuffleDeck`, `dealHoleCards`
   * Hand evaluation helpers
   * State transitions between streets
4. Write **unit tests** for:

   * Correct actions per street
   * Side pots
   * Showdown outcomes
5. Only then hook into:

   * `game.service.ts`
   * WebSocket gateway

**Important:** Engine must remain **pure** (no DB, no network).

---

# 5. Backend Workflow

### 5.1 Adding a New REST Endpoint

1. Check `/docs/specs/rest-api-spec.md`.
2. Implement controller in `/backend/src/api/<feature>.controller.ts`.
3. Implement logic in `/backend/src/services/<feature>.service.ts`.
4. Add types and validation (`zod` or similar).
5. Add Prisma queries in `/backend/src/db` or service layer.
6. Write integration tests for that endpoint.

### 5.2 Modifying Game Flow

If modification affects **poker rules**:

* Update:

  * `/docs/features/gameplay-texas-holdem.md`
  * `/docs/specs/game-engine-spec.md`
* Update engine implementation and tests.
* Ensure WebSocket types and UI expectations remain aligned.

### 5.3 Error Handling

* Always use the standardized error format:

  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-readable error"
    }
  }
  ```

* Map engine or service errors to HTTP/WebSocket error codes:

  * `INVALID_ACTION`
  * `TABLE_NOT_FOUND`
  * `NOT_IN_TABLE`
  * etc.

---

# 6. Frontend Workflow

### 6.1 UI Components

* Use Tailwind utility classes.
* Extract repeated patterns into components in `/components/ui`:

  * `Button`, `Card`, `Modal`, `Input`, etc.
* Prefer functional components with hooks.

### 6.2 Data Fetching

* Use React Query or SWR:

  * `/api/dashboard/*`
  * `/api/tables/*`
* Keep forms and remote calls in containers/hooks, not deeply inside UI components.

### 6.3 WebSocket Integration

* Wrap WS logic in `useWebSocket` or `useTableState` hooks.
* Centralize message handling:

  * Single `socket.on("message", handler)` that dispatches based on `type`.

### 6.4 Testing

* Component tests for UI states.
* Integration tests for pages (with mocked REST/WS).

---

# 7. Docs-Driven Development

Documentation is part of the contract. When you:

* Add a new feature → update the relevant `docs/*` file.
* Change behavior of an API → update:

  * `/docs/specs/rest-api-spec.md`
  * `/docs/specs/websocket-protocol.md` (if WS is affected)
* Modify game rules → update:

  * `/docs/features/gameplay-texas-holdem.md`
  * `/docs/specs/game-engine-spec.md`

**PRs that change behavior must include doc updates.**

---

# 8. Testing Strategy

### 8.1 Levels of Testing

1. **Unit Tests**

   * Engine logic (dealing, betting, evaluation).
   * Service-level functions (metrics calculation, chat validation).
2. **Integration Tests**

   * REST endpoints using supertest.
   * WebSocket flows using WS test clients.
3. **E2E Tests**

   * Full scenario:

     * Create table → join from two players → play a hand → verify dashboard updates.

### 8.2 Required Tests per Feature

When adding or changing a feature:

* New engine feature → engine unit tests.
* New API route → at least one integration test.
* New dashboard behavior → FE tests or storybook + integration.

---

# 9. Environment Management

### 9.1 Local

* `.env` for local dev variables.
* Use Supabase project (dev) + local Redis via Docker.

### 9.2 Staging / Production

* Prefer separate Supabase projects and Redis instances.
* Protect environment variables and credentials.

---

# 10. PR Checklist

Before opening a PR:

* [ ] All relevant docs are updated.
* [ ] `npm run lint` passes.
* [ ] `npm test` passes (or specific test suites).
* [ ] No obvious console logs left behind (except for structured logging).
* [ ] Changes are scoped and not mixing unrelated refactors.

---

# 11. Communication & Ownership

* Each feature or bug has a clear owner (the agent who opened the branch).
* Ownership includes:

  * Code
  * Tests
  * Docs
* If behavior is ambiguous, refer to:

  * Specs in `/docs/specs/*`
  * Architecture docs
* If the spec and code disagree, **spec is the source of truth** and should either:

  * Be updated (if spec is outdated), or
  * Drive code changes.

---

# 12. Summary

This development workflow is built to:

* Keep the system consistent
* Make onboarding new agents easy
* Ensure behavior is always documented
* Maintain a clean separation between:

  * Engine
  * Backend services
  * WebSocket routing
  * Frontend UI

All contributors should follow this document for any work in this repository.
