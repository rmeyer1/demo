
## `/docs/testing/testing-overview.md`

````md
# Testing Overview

This document describes the **overall testing strategy** for the Texas Hold’em Home Game platform.

Tools:

- **Vitest** – unit tests (engine, services, helpers)
- **Playwright (Node bindings)** – integration + end-to-end (E2E) tests

Detailed plans:

- `/docs/testing/engine-test-plan.md`
- `/docs/testing/backend-test-plan.md`
- `/docs/testing/frontend-test-plan.md`
- `/docs/testing/e2e-playwright-test-plan.md`

---

## 1. Goals

- Ensure **correctness** of poker rules and game engine behavior.
- Validate **REST APIs** and **WebSocket** flows.
- Guarantee **UI flows** work end-to-end (auth → table → play → dashboard).
- Catch regressions early via **automated test suites**.
- Make it easy for any agent to add **new tests** alongside new features.

---

## 2. Test Layers

We use 3 layers of tests:

1. **Unit tests** (Vitest)
   - Small, fast, isolated
   - Engine logic, helpers, pure services

2. **Integration tests** (Playwright API & WS or Vitest with test server)
   - Backend REST endpoints
   - WebSocket message flows
   - Interactions with DB/Redis

3. **End-to-End tests** (Playwright browser)
   - Full flows from user perspective
   - UI + backend + DB + WS

---

## 3. Test Directories

Recommended structure:

```txt
/backend
  /src
  /tests
    unit/
      engine/
      services/
    integration/
      api/
      websocket/
  vitest.config.ts
  playwright.config.ts

/frontend
  /src or /app
  /tests
    unit/
      components/
      hooks/
    e2e/   (optional, or keep all E2E at root)

tests/
  e2e/
    playwright/
      auth.spec.ts
      lobby.spec.ts
      table-play.spec.ts
      dashboard.spec.ts
````

You can keep all Playwright tests in a single `tests/e2e/playwright/` folder and point `playwright.config.ts` there.

---

## 4. Vitest Configuration

* One Vitest config per project (backend, frontend).
* Typical config:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});
```

Add additional configs if you want separate unit/integration suites.

---

## 5. Playwright Configuration

At repo root:

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/playwright",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm run dev --workspace frontend",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "npm run dev --workspace backend",
      url: "http://localhost:4000",
      reuseExistingServer: !process.env.CI
    }
  ]
});
```

Adjust workspace commands if you’re not using npm workspaces.

---

## 6. What Runs Where

* **Vitest (Unit)**

  * Engine core: dealing, betting, pot, showdown
  * Backend services: chat, metrics, auth wrappers
  * Frontend hooks & pure utility logic

* **Playwright (Integration)**

  * REST endpoints via `request` API
  * WebSocket flows via browser or Node context

* **Playwright (E2E)**

  * Full UX flows: login → lobby → table → play → results → dashboard

---

## 7. CI Strategy

In CI, run tests in this order:

1. `npm run test:unit` (Vitest backend + frontend)
2. `npm run test:integration` (Playwright API / WS)
3. `npm run test:e2e` (Playwright browser flows)

Block merging to `main` if any suite fails.

---

## 8. Adding New Tests

When adding a feature:

* Engine / logic change → add **Vitest unit tests**.
* New REST endpoint → add **Playwright integration tests** (API).
* New user flow or significant UX → add **Playwright E2E** tests.

Always update:

* `/docs/testing/*` if behavior under test changed.

````