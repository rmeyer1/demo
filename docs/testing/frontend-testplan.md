## `/docs/testing/frontend-test-plan.md`

```md
# Frontend Test Plan (Components + Hooks)

This document defines the **frontend test plan** using Vitest for unit tests and Playwright for E2E/UI flows.

---

## 1. Scope

We test:

- Presentational components (buttons, cards, forms)
- Complex components (table, chat, dashboard widgets)
- Hooks (auth, WebSocket, table state, chat)
- Page-level behavior (basic smoke tests)

Deeper user flows are covered in E2E tests:  
`/docs/testing/e2e-playwright-test-plan.md`.

---

## 2. Tools

- **Vitest** + **Testing Library (React)** for component tests.
- **Vitest** for hooks (using `@testing-library/react-hooks` or similar approach).
- **Playwright** for full browser flows.

---

## 3. Component Tests

Directory:

```txt
/frontend/tests/unit/components/
  ui/
    Button.test.tsx
    Modal.test.tsx
  table/
    PokerTable.test.tsx
    PlayerSeat.test.tsx
    CommunityCards.test.tsx
  chat/
    ChatPanel.test.tsx
    ChatMessageList.test.tsx
  dashboard/
    StatsSummary.test.tsx
    NetChipsChart.test.tsx
````

### 3.1 UI Components

* **Button**

  * Renders primary, secondary, ghost variants.
  * Forwards `onClick`.
  * Disabled state.

* **Modal**

  * Shows/hides based on props.
  * Renders children correctly.
  * Handles close actions.

### 3.2 Poker Table Components

* **PlayerSeat**

  * Shows display name, stack, status (folded, all-in).
  * Highlights "you" seat.
  * Dealer button indicator.

* **CommunityCards**

  * Renders 0–5 community cards.
  * Uses stable keys.

* **PokerTable**

  * Lays out seats around the table.
  * Renders pot total.
  * Renders community cards.

Mocks state props to avoid real WS calls.

### 3.3 Chat Components

* **ChatMessageList**

  * Renders messages with displayName, content, timestamp.
  * Auto-scroll logic (may mock intersection/scrolling parts).

* **ChatPanel**

  * Integrates list + input.
  * Calls `onSend` with correct content.

### 3.4 Dashboard Components

* **StatsSummary**

  * Given metrics props, displays correct values and formats.
  * Handles `null` metrics as `N/A`.

* **NetChipsChart**

  * Renders line chart with points.
  * Handles empty data gracefully.

---

## 4. Hooks Tests

Directory:

```txt
/frontend/tests/unit/hooks/
  useAuth.test.ts
  useTableState.test.ts
  useWebSocket.test.ts
  useChat.test.ts
  useDashboard.test.ts
```

### 4.1 useAuth

* Returns `user = null` and `loading = true` initially.
* After mock Supabase session, sets correct user.
* Handles logout (session = null) updates.

### 4.2 useWebSocket

* Connects to mock WS server (use `socket.io-mock` or inject a test client).
* Reconnects on token change (if desired).
* Handles cleanup on unmount.

### 4.3 useTableState

* When receiving `TABLE_STATE`, updates local state.
* Correctly maps server payload to React state (`players`, `pot`, `street`, etc.).
* Handles `HAND_RESULT` overlay state (e.g., show last result).

### 4.4 useChat

* On `CHAT_MESSAGE`, appends to list.
* Ignores messages for other tables.
* Provides `sendMessage` that calls `socket.emit` with correct payload.

### 4.5 useDashboard

* Fetches summary + progression via mocked `apiClient`.
* Stores and exposes loading/error states.

---

## 5. Page-Level Unit / Smoke Tests

Directory:

```txt
/frontend/tests/unit/pages/
  index.test.tsx
  lobby.test.tsx
  table-id.test.tsx
  dashboard.test.tsx
```

* **Landing page**:

  * Renders CTAs (Login, Get Started).
* **Lobby page**:

  * Makes API call to get tables (mocked).
  * Renders list of tables.
* **Table page**:

  * Shows placeholder or loading until WS state arrives.
* **Dashboard page**:

  * Fetches metrics and displays summary cards.

These tests stub data fetching / WS; E2E tests cover full stack.

---

## 6. Vitest Setup

Example `vitest.config.ts` for frontend:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setupTests.ts",
    include: ["tests/unit/**/*.test.ts?(x)"]
  }
});
```

`setupTests.ts` can configure Testing Library and mock globals.

---

## 7. Running Frontend Unit Tests

From `/frontend`:

```bash
npm run test:unit
```

Example script:

```json
{
  "scripts": {
    "test:unit": "vitest run tests/unit"
  }
}
```

---

## 8. Relationship to E2E Tests

* Component & hook tests ensure each piece works in isolation.
* E2E Playwright tests ensure **end-to-end behavior** is correct across frontend + backend + DB.

Both layers are important and complementary.

````