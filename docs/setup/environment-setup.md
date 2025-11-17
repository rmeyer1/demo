---

# ✅ `/docs/setup/environment-setup.md`

```md
# Development Environment Setup (Agents)

This document describes how to set up the complete development environment for the Texas Hold’em Home Game Platform, using:

- **Next.js** frontend
- **Node.js + TypeScript** backend
- **Supabase** for Postgres + Auth
- **Prisma** ORM
- **Redis** for in-memory game state
- **WebSockets** for realtime gameplay + chat

---

# 1. Prerequisites

### Required Tools
Install these before starting:

- **Node.js 20+**
- **npm** or **pnpm**
- **Git**
- **Docker Desktop** (optional, for local Redis)
- **Supabase account** (https://supabase.com)

### Optional but recommended
- VSCode with:
  - ESLint
  - Prettier
  - Tailwind IntelliSense
  - Prisma extension

---

# 2. Clone the Repository

```sh
git clone https://github.com/<your-repo>/poker-platform.git
cd poker-platform
````

---

# 3. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Obtain the following values:

   * `SUPABASE_URL`
   * `SUPABASE_SERVICE_ROLE_KEY`
   * `SUPABASE_ANON_KEY`
4. Get your **Postgres connection string**:

   ```
   postgresql://postgres:<password>@db.<subdomain>.supabase.co:5432/postgres
   ```

---

# 4. Setup Environment Variables

Create a root `.env` file with:

```
# Supabase
SUPABASE_URL=<your-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Database connection (for Prisma)
DATABASE_URL="postgresql://postgres:<pass>@db.<domain>.supabase.co:5432/postgres"

# Auth JWT verification
SUPABASE_JWT_SECRET=<your-supabase-jwt-secret>

# Redis connection
REDIS_URL="redis://localhost:6379"

# Backend
PORT=4000
JWT_AUDIENCE="authenticated"
```

---

# 5. Install Dependencies (Root)

```sh
npm install
```

This installs shared tooling (linting, formatting, types).

---

# 6. Backend Setup

Navigate to backend folder:

```
cd backend
npm install
```

Install main packages:

```sh
npm install fastify socket.io redis ioredis zod
npm install @supabase/supabase-js
npm install @prisma/client
npm install -D prisma typescript ts-node nodemon
```

### Initialize Prisma

```sh
npx prisma init
```

### Apply Database Schema

Run migrations:

```sh
npx prisma migrate dev
```

### Start Backend Dev Server

```sh
npm run dev
```

Typical scripts:

```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

---

# 7. Redis Setup

### Option A: Local Redis (Docker)

```sh
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:latest
```

### Option B: Upstash Redis (hosted)

* Create a free Redis database at:
  [https://upstash.com](https://upstash.com)

* Use the provided `REDIS_URL`.

---

# 8. Frontend Setup

Navigate to frontend:

```
cd ../frontend
npx create-next-app@latest . --ts
```

Install dependencies:

```sh
npm install @supabase/supabase-js socket.io-client @tanstack/react-query
```

---

# 9. Tailwind Setup (Frontend)

Install Tailwind:

```sh
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:

```js
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}"
  ],
  theme: { extend: {} },
  plugins: []
};
```

`app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

# 10. WebSocket Configuration (Frontend)

Use token from Supabase Auth:

```ts
const token = supabase.auth.getSession().data.session?.access_token;

const socket = io(BACKEND_WS_URL, {
  auth: { token }
});
```

Backend verifies the token using Supabase JWK.

---

# 11. Developer Workflow

### Engine Development

* Implement in `/backend/src/engine`
* Must conform to `/docs/specs/game-engine-spec.md`
* Write unit tests for:

  * Street transitions
  * Pot management
  * Hand evaluation
  * Betting logic
  * Side pots

### Backend Development

* Add routes in `/src/api`
* Add message handlers in `/src/ws`
* Update services in `/src/services`

### Frontend Development

* Build pages under `/app`
* Use React Query or SWR for REST calls
* Use WebSocket hooks for gameplay/chat

---

# 12. Testing Commands

### Backend tests

```sh
npm run test
```

### Frontend tests

```sh
npm run test
```

### End-to-end (Playwright or Cypress)

```sh
npm run e2e
```

---

# 13. Summary

By the end of setup:

* Supabase hosts the database + auth
* Prisma manages migrations
* Node backend runs game engine and WebSockets
* Redis stores table state
* Next.js renders the UI
* Everything authenticates via Supabase JWTs

Your environment is now fully ready for feature implementation.