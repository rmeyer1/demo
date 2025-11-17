## `/docs/setup/frontend-setup.md`

````md
# Frontend Setup (Next.js + Tailwind + Supabase + WebSockets)

This document explains how to set up the **frontend application** for the Texas Hold’em Home Game platform.

The frontend stack:

- **Next.js** (App Router, TypeScript)
- **React**
- **Tailwind CSS**
- **Supabase client** (for auth)
- **WebSocket client** (for realtime gameplay + chat)
- **React Query or SWR** (for REST data fetching)

---

# 1. Prerequisites

Before you start, ensure you have:

- Node.js **20+**
- npm or pnpm
- Git
- A running backend (see `/docs/setup/backend-setup.md`)
- A Supabase project and `.env` configured (see `/docs/setup/environment-setup.md`)

---

# 2. Directory Layout

We assume the following repo structure:

```txt
/
  backend/
  frontend/
  docs/
  package.json
````

The frontend lives entirely under `/frontend`.

---

# 3. Create the Next.js App

If the `frontend` folder is not yet initialized:

```bash
cd frontend
npx create-next-app@latest . --ts
```

During the prompts you can generally accept defaults, but:

* Use **TypeScript** → **Yes**
* Use **App Router** → **Yes**
* Use **Tailwind?** → You can say **No** here if you want to follow our manual Tailwind setup in `/docs/setup/tailwind-setup.md` (recommended so everything’s consistent with the docs).

If `create-next-app` already generated some boilerplate, you can keep it and adapt as you go.

---

# 4. Install Required Dependencies

From the `/frontend` directory:

```bash
npm install @supabase/supabase-js
npm install socket.io-client
npm install @tanstack/react-query
npm install zod

# Dev dependencies (optional but recommended)
npm install -D @types/node @types/react @types/react-dom
```

If you want SWR instead of React Query:

```bash
npm install swr
```

Use **one** (React Query or SWR) to avoid duplication.

---

# 5. Environment Variables (Frontend)

The frontend needs **public** Supabase keys and backend URLs.
Create or update `/frontend/.env.local`:

```env
# Supabase public client (safe in frontend)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Backend REST API base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Backend WebSocket URL (Socket.IO or native WS, depending on backend)
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

> Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend.
> That key is **server-side only** (backend).

---

# 6. Project Structure (Recommended)

Under `/frontend`:

```txt
frontend/
  app/
    layout.tsx
    page.tsx              (landing)
    auth/
      login/
        page.tsx
      register/
        page.tsx
    lobby/
      page.tsx
    table/
      [id]/
        page.tsx
    dashboard/
      page.tsx
    globals.css
  components/
    layout/
      Header.tsx
      Footer.tsx
      MainLayout.tsx
    ui/
      Button.tsx
      Card.tsx
      Modal.tsx
      Input.tsx
      Select.tsx
      Tabs.tsx
    table/
      PokerTable.tsx
      PlayerSeat.tsx
      CommunityCards.tsx
      ActionControls.tsx
      TableHud.tsx
      PotDisplay.tsx
    chat/
      ChatPanel.tsx
      ChatMessageList.tsx
      ChatInput.tsx
    dashboard/
      StatsSummary.tsx
      NetChipsChart.tsx
  hooks/
    useAuth.ts
    useWebSocket.ts
    useTableState.ts
    useChat.ts
    useDashboard.ts
  lib/
    supabaseClient.ts
    apiClient.ts
    wsClient.ts
    types.ts
  public/
    (static assets)
  tailwind.config.js
  postcss.config.js
  tsconfig.json
```

---

# 7. Supabase Client Setup

Create `/frontend/lib/supabaseClient.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Use this instance in your hooks (`useAuth`, etc.).

---

# 8. Auth Hook (Example)

Create `/frontend/hooks/useAuth.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useAuth() {
  const [user, setUser] = useState<null | { id: string; email?: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // initial fetch
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
```

---

# 9. API Client Setup

Create `/frontend/lib/apiClient.ts`:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = (await import("@/lib/supabaseClient")).supabase.auth
    .getSession()
    .then(({ data }) => data.session?.access_token);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${await token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || res.statusText);
  }

  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body || {}) }),
  // add put/delete as needed
};
```

---

# 10. WebSocket Client Setup

Create `/frontend/lib/wsClient.ts` (Socket.IO example):

```ts
"use client";

import { io, Socket } from "socket.io-client";
import { supabase } from "./supabaseClient";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL!;

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;

  socket = io(WS_URL, {
    auth: { token },
    transports: ["websocket"],
  });

  return socket;
}
```

Use this in a hook like `useWebSocket` or `useTableState`.

---

# 11. Tailwind Setup

For Tailwind-specific configuration, see
`/docs/setup/tailwind-setup.md`.

Ensure:

* `app/globals.css` includes:

  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```

* `tailwind.config.js` is configured to scan `app` and `components` directories.

---

# 12. Running the Frontend

From `/frontend`:

```bash
npm run dev
```

By default, app runs at:

```txt
http://localhost:3000
```

Ensure the backend is running at `http://localhost:4000` (or update `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_URL` to match).

---

# 13. Next Steps

* Implement pages:

  * `/auth/login`, `/auth/register`
  * `/lobby`
  * `/table/[id]`
  * `/dashboard`
* Integrate React Query or SWR for data fetching.
* Implement WebSocket message handling per `/docs/specs/websocket-protocol.md`.

````