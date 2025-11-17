## `/docs/testing/e2e-playwright-test-plan.md`

```md
# E2E Test Plan (Playwright)

This document defines the **end-to-end (E2E)** test plan using **Playwright (Node bindings)**.

E2E tests simulate **real user flows** involving:

- Frontend (Next.js)
- Backend (REST + WS)
- Supabase (Auth + DB)
- Redis (state)
- Game Engine

---

## 1. Setup & Environment

E2E tests live under:

```txt
/tests/e2e/playwright/
  auth.spec.ts
  lobby.spec.ts
  table-play.spec.ts
  chat.spec.ts
  dashboard.spec.ts
````

Playwright config: `/playwright.config.ts`

### 1.1 Pre-requisites

* Backend dev server running (or started via `webServer` in config).
* Frontend dev server running (or started via `webServer`).
* Test DB & Redis configured (separate from production/staging).
* Supabase test project or isolated schema.

---

## 2. Shared Utilities

Common helpers:

* `createTestUser()` – via Supabase (REST or direct DB insert).
* `loginViaUI(page)` – uses UI login forms.
* `createTableViaAPI()` – optional direct call to backend for quick setup.
* `joinTableByCodeViaUI(page, inviteCode)` – full UI flow.

---

## 3. E2E Scenarios

### 3.1 Auth & Profile

File: `auth.spec.ts`

Scenarios:

1. **User Registration & Login**

   * Navigate to `/auth/register`.
   * Fill email + password + display name.
   * Submit.
   * Verify redirect to lobby.
   * Verify header shows user display name or account menu.

2. **Login Existing User**

   * Navigate to `/auth/login`.
   * Enter valid credentials.
   * Verify redirect to lobby.

3. **Auth Guard**

   * Visit `/lobby` without being logged in.
   * Expect redirect to `/auth/login` or appropriate UI prompt.

---

### 3.2 Lobby & Table Creation

File: `lobby.spec.ts`

Scenarios:

1. **Create Table**

   * Logged-in user visits `/lobby`.
   * Clicks "Create Table" button.
   * Fills form (name, blinds, max players).
   * Submits.
   * New table appears in "My Tables" list with correct info.

2. **Join by Invite Code**

   * Copy invite code for a created table (from UI or API).
   * Log in as a different user.
   * Go to lobby, enter invite code, click join.
   * Verify table appears in their list.
   * Verify they can navigate to `/table/[id]`.

---

### 3.3 Gameplay Flow (Multi-User)

File: `table-play.spec.ts`

Use **two Playwright browser contexts** to simulate two players (A and B).

Scenarios:

1. **Two Players Sit & Start Hand**

   * Player A:

     * Logs in, creates table, navigates to `/table/[id]`.
     * Sits at seat 0 with stack 2000.
   * Player B:

     * Logs in, joins table, navigates to `/table/[id]`.
     * Sits at seat 1 with stack 2000.
   * Backend triggers start of hand (automatic or via debug endpoint).
   * Both players:

     * See `HOLE_CARDS` appear.
     * See initial `TABLE_STATE` with correct blinds + turn order.

2. **Simple Hand with Fold**

   * Player A: preflop raise.
   * Player B: fold.
   * Assert:

     * Hand result shows Player A as winner.
     * Stacks updated in UI for both players.
     * Next hand can start without errors.

3. **Hand to Showdown**

   * Pre-seed or rely on engine randomness.
   * Force both players to reach showdown (e.g., all-in and call).
   * Assert:

     * Community cards fully displayed.
     * Winner indicated.
     * Stacks updated.
     * No stale "your turn" indicators left.

*(For reliability, you may create a deterministic mode in engine for E2E tests only.)*

---

### 3.4 Chat During Game

File: `chat.spec.ts`

Scenarios:

1. **Send & Receive Chat**

   * Player A and B both at same table.
   * Player A sends: "GLGL".
   * Player B sees "GLGL" appear almost immediately.
   * Message includes correct display name and seat index.

2. **Chat History**

   * Refresh page for Player B.
   * Chat panel loads and shows previous "GLGL" message via REST history.
   * New messages from that point still come via WS.

3. **Validation**

   * Send an empty or whitespace-only message (if UI allows).
   * Expect either:

     * Prevented client-side, or
     * Server returns error (shown in UI).

---

### 3.5 Dashboard Metrics

File: `dashboard.spec.ts`

Scenarios:

1. **Dashboard After a Few Hands**

   * Player plays 5–10 hands at a table (you can simplify by having mostly fold/raise actions).
   * Navigate to `/dashboard`.
   * Verify:

     * `totalHands` > 0.
     * `netChips` matches rough expectations (you can control actions in test).
     * `VPIP`, `PFR`, `Showdown%`, `BB/100` all render without errors.
   * Change range (Lifetime vs 7d vs 30d).
   * Verify chart updates without error.

---

## 4. Integration Checks within E2E

E2E should implicitly verify:

* Supabase Auth + JWT → backend REST + WS flows.
* DB writes:

  * Table creation
  * Seat assignment
  * Chat messages
  * Hands & player_hands for metrics
* Redis:

  * Table state updates are consistent between actions.

---

## 5. Running E2E Tests

From repo root (or wherever `playwright.config.ts` lives):

```bash
npx playwright test
```

Or via script:

```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

Use headed mode for debugging:

```bash
npx playwright test --headed --debug
```

---

## 6. CI Considerations

* Start backend + frontend via `webServer` config or separate steps.
* Use a dedicated test DB schema (or project) and Redis instance.
* Ensure DB cleanup between test runs:

  * Run migrations at test start.
  * Truncate tables after each file/suite.

---

## 7. Maintenance Guidelines

When adding new features:

* Add at least one E2E test if:

  * It creates a new user-facing flow (e.g., new page or new major feature on an existing page).
  * It significantly changes the way users interact with tables, chat, or dashboard.

Keep E2E tests:

* Focused on **happy paths** and a few key edge cases.
* Deterministic (avoid randomness in engine for these tests where possible).

```