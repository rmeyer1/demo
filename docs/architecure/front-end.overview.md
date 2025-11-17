You’re right, those two were pretty thin. Here are **fully regenerated, complete versions** of both docs, ready to drop into your repo.

---

## `/docs/architecture/frontend-overview.md`

````md
# Frontend Architecture Overview (Next.js + Tailwind + WebSockets)

This document describes the **frontend architecture** for the Texas Hold'em Home Game application.  
It defines the structure, responsibilities, and integration points so agents can build the UI in a consistent way.

---

## 1. Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **UI Library:** React
- **Styling:** Tailwind CSS
- **State / Data Fetching:** React Query or SWR (TBD, but pick one and stay consistent)
- **Realtime:** WebSocket client (e.g. `socket.io-client` or native `WebSocket`)
- **Forms / Validation:** Basic React hooks + minimal helper libs (e.g., `zod` if needed)

---

## 2. High-Level Responsibilities

The frontend is responsible for:

- Rendering **pages** and **components**:
  - Landing page, auth flows, lobby, table, dashboard
- Managing **UI state**:
  - Current user session
  - Selected table, seat, action controls
  - Realtime updates and chat messages
- Talking to the backend via:
  - **REST API** for auth, lobby, dashboard, chat history
  - **WebSockets** for realtime gameplay and chat

**The frontend never implements game rules or trusted logic**. It only reflects server state.

---

## 3. Directory Structure

Example proposed structure under Next.js App Router:

```txt
/frontend
  /app
    /api          (if using Next API routes as BFF, optional)
    /auth
      login/page.tsx
      register/page.tsx
    /lobby
      page.tsx
    /table
      [id]/page.tsx
    /dashboard
      page.tsx
    layout.tsx
    page.tsx      (landing)
    globals.css   (includes Tailwind directives)
  /components
    /layout
      Header.tsx
      Footer.tsx
      MainLayout.tsx
    /ui
      Button.tsx
      Card.tsx
      Modal.tsx
      Input.tsx
      Select.tsx
      Tabs.tsx
    /table
      PokerTable.tsx
      PlayerSeat.tsx
      CommunityCards.tsx
      ActionControls.tsx
      PotDisplay.tsx
      TableHud.tsx
    /chat
      ChatPanel.tsx
      ChatMessageList.tsx
      ChatInput.tsx
    /dashboard
      StatsSummary.tsx
      NetChipsChart.tsx
  /lib
    apiClient.ts   (REST helpers)
    wsClient.ts    (WebSocket client)
    auth.ts        (token/session helpers)
    types.ts       (shared frontend-side types)
  /hooks
    useAuth.ts
    useTableState.ts
    useWebSocket.ts
    useChat.ts
    useDashboard.ts
  /public
    (static assets)
  tailwind.config.js
  postcss.config.js
  tsconfig.json
````

---

## 4. Routing & Pages

### 4.1 Landing Page (`/`)

Responsibilities:

* Show product summary (“Host online Texas Hold’em with your friends”).
* CTA buttons:

  * “Get Started” → `/auth/register`
  * “Log In” → `/auth/login`
* Explain basic features:

  * Private tables, realtime play, performance dashboard.

### 4.2 Auth Pages

* `/auth/login`

  * Email/password form.
  * On success: redirect to `/lobby`.
* `/auth/register`

  * Email, password, display name.
  * On success: log in and redirect to `/lobby`.

Use REST endpoints from `/docs/specs/rest-api-spec.md`.

### 4.3 Lobby (`/lobby`)

Responsibilities:

* List “my tables”:

  * Hosted by the user.
  * Currently active or recently played.
* Actions:

  * “Create Table” (opens modal or separate form).
  * “Join Table by Code” (enter invite code).
* Table cards show:

  * Name, host, status (`OPEN`, `IN_GAME`), # players.

### 4.4 Table Page (`/table/[id]`)

This is the **core gameplay screen**.

Layout:

* **Center**: `PokerTable` with:

  * Oval table graphic (Tailwind-based, no heavy graphics required)
  * `PlayerSeat` components around the table
  * `CommunityCards` and `PotDisplay` in the middle
* **Bottom**: `ActionControls`

  * Buttons: Fold, Check/Call, Bet/Raise
  * Slider or numeric input for bet size
  * Context info: “It’s your turn”, call amount, pot odds (later)
* **Right side (or bottom on mobile)**: `ChatPanel`

  * Scrollable `ChatMessageList`
  * `ChatInput` at bottom
* **Top / HUD**: `TableHud`

  * Table name, current blinds, hand number, dealer button indicator

Integration:

* On mount:

  * Fetch initial table info via REST `/api/tables/:id`
  * Connect WebSocket for that `tableId` and start listening to events
* WebSocket events:

  * `TABLE_STATE`, `HOLE_CARDS`, `ACTION_TAKEN`, `HAND_RESULT`, `CHAT_MESSAGE` etc.
* User actions:

  * Dispatch `PLAYER_ACTION` and `CHAT_SEND` events over WebSocket.

### 4.5 Dashboard (`/dashboard`)

Responsibilities:

* Show **player performance metrics**:

  * Total hands
  * Net chips
  * VPIP, PFR, showdown win rate
  * BB/100
* Time-range filter:

  * `Lifetime`, `Last 7d`, `Last 30d`
* Components:

  * `StatsSummary` for metrics cards
  * `NetChipsChart` (line chart) using simple chart library

Data:

* Fetch from:

  * `GET /api/dashboard/summary`
  * `GET /api/dashboard/progression`

---

## 5. State & Data Flow

### 5.1 REST Data

* Use React Query or SWR hooks for:

  * Auth status (`/api/auth/me`)
  * Table metadata & lists
  * Dashboard data
  * Chat history (`GET /api/tables/:id/chat`)

Example pattern:

```ts
const { data: table } = useQuery(["table", tableId], () =>
  apiClient.getTable(tableId)
);
```

### 5.2 WebSocket Data

* Use a `useWebSocket` hook to:

  * Open connection when `/table/[id]` page mounts
  * Close on unmount or navigation
* Use `useTableState` + `useChat` hooks to:

  * Maintain local UI state derived from server events
  * Example: `TABLE_STATE` updates replace or patch local state

```ts
// Pseudocode
useEffect(() => {
  const socket = connectToTable(tableId, token);
  socket.on("TABLE_STATE", handleTableState);
  socket.on("CHAT_MESSAGE", handleChatMessage);
  return () => socket.disconnect();
}, [tableId, token]);
```

---

## 6. Tailwind Usage Guidelines

* **Global styles**:

  * `app/globals.css` must include:

    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    ```
* **Design language**:

  * Dark theme by default (poker table feel)
  * Use utility-first classes:

    * Layout: `flex`, `grid`, `gap-*`, `p-*`, `m-*`
    * Color palette: keep a small set of semantic colors (e.g. `bg-slate-900`, `bg-emerald-600`, `text-slate-50`)
* **Component patterns**:

  * Abstract repeated Tailwind combos into `className` helpers in shared UI components (`Button`, `Card`, etc.).
  * Use responsive classes to ensure good mobile experience on `/table/[id]` and `/dashboard`.

---

## 7. Error Handling

* Auth failures:

  * Show inline errors on login/register.
* Network errors:

  * For REST: generic toast or inline messages.
  * For WebSocket: show banner if disconnected and attempt reconnect.
* Invalid actions:

  * If backend sends `ERROR` event, show toast or inline message (e.g., “Not your turn”, “Insufficient chips”).

---

## 8. Testing (Frontend)

* Component tests:

  * UI components (Button, Card, PokerTable layout)
* Integration tests:

  * Table page with mocked WebSocket events
  * Dashboard with mocked API responses
* E2E (with backend or mocks):

  * Basic flow: login → create table → join table → play hand → see results → view dashboard

---

## 9. Non-Goals (Frontend)

* No game logic or client-side move validation beyond basic UX (e.g., disabling buttons when it’s clearly not the player’s turn).
* No offline mode in V1.
* No SEO-optimized content for every internal page (focus is app, not marketing).

