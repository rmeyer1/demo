---

## `/docs/setup/backend-setup.md`

```md
# Backend Setup (Node.js + TypeScript + Supabase + Redis + WebSockets)

This document explains how to set up the **backend** for the Texas Hold’em Home Game platform.

Backend stack:

- Node.js 20+
- TypeScript
- Fastify / Express / NestJS (generic instructions assume Fastify or Express)
- WebSocket (Socket.IO or `ws`)
- Supabase (Postgres + Auth)
- Prisma ORM
- Redis (table state + pub/sub)

---

# 1. Prerequisites

- Node.js **20+**
- npm or pnpm
- Git
- A Supabase project & env configured (see `/docs/setup/environment-setup.md`)
- Redis (local Docker or hosted) (see `/docs/setup/environment-setup.md`)

---

# 2. Directory Layout

We assume the backend lives in `/backend`:

```txt
/backend
  /src
    /api
    /ws
    /engine
    /services
    /db
    /config
    server.ts
  package.json
  tsconfig.json
  prisma/
    schema.prisma
````

---

# 3. Initialize Backend Project

From repo root:

```bash
cd backend
npm init -y
```

Install dependencies:

```bash
npm install fastify fastify-cors
npm install socket.io
npm install ioredis
npm install @supabase/supabase-js
npm install @prisma/client
npm install zod

# Dev dependencies
npm install -D typescript ts-node nodemon prisma
npm install -D @types/node
```

---

# 4. TypeScript Configuration

Create `tsconfig.json` in `/backend`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

---

# 5. Prisma Setup

Initialize Prisma:

```bash
npx prisma init
```

This creates:

* `/backend/prisma/schema.prisma`
* `.env` inside backend (you can ignore this if using root `.env` — just copy or point to root).

Update `schema.prisma` to use Supabase Postgres:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

Add models according to
`/docs/architecture/database-schema.md`.

Then:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

# 6. Environment Variables (Backend)

Configured in root `.env` (or `/backend/.env` if you prefer):

```env
# Supabase
SUPABASE_URL=https://<your>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # used if needed for admin ops (careful)
SUPABASE_JWT_SECRET=<supabase-jwt-secret>

# Postgres (Supabase DB)
DATABASE_URL=postgresql://postgres:<password>@db.<domain>.supabase.co:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Backend
PORT=4000
NODE_ENV=development
```

> Backend must **never** expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.

---

# 7. Database Clients

Create `/backend/src/db/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

Create `/backend/src/db/redis.ts`:

```ts
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL!;
export const redis = new Redis(redisUrl);
```

---

# 8. Supabase JWT Validation

You can validate access tokens using the `SUPABASE_JWT_SECRET`.

Create `/backend/src/config/auth.ts`:

```ts
import jwt from "jsonwebtoken";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

export interface AuthTokenPayload {
  sub: string; // user id
  email?: string;
  // ... other fields from Supabase
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  try {
    const payload = jwt.verify(token, SUPABASE_JWT_SECRET) as AuthTokenPayload;
    return payload;
  } catch (e) {
    throw new Error("INVALID_TOKEN");
  }
}
```

(You’ll need `npm install jsonwebtoken` and `npm install -D @types/jsonwebtoken`.)

---

# 9. Fastify Server Setup

Create `/backend/src/server.ts`:

```ts
import "dotenv/config";
import fastify from "fastify";
import cors from "@fastify/cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { registerRoutes } from "./api/routes";
import { setupWebSocketGateway } from "./ws/websocket-gateway";

const PORT = Number(process.env.PORT || 4000);

async function start() {
  const app = fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register REST routes
  registerRoutes(app);

  // Create HTTP server for both Fastify and Socket.IO
  const httpServer = createServer(app as any);

  // Attach Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  setupWebSocketGateway(io);

  httpServer.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

# 10. REST Routes Registration

Create `/backend/src/api/routes.ts`:

```ts
import { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.controller";
import { registerTableRoutes } from "./tables.controller";
import { registerDashboardRoutes } from "./dashboard.controller";
import { registerChatRoutes } from "./chat.controller";

export async function registerRoutes(app: FastifyInstance) {
  app.register(registerAuthRoutes, { prefix: "/api/auth" });
  app.register(registerTableRoutes, { prefix: "/api/tables" });
  app.register(registerDashboardRoutes, { prefix: "/api/dashboard" });
  app.register(registerChatRoutes, { prefix: "/api" });
}
```

Then implement each controller as specified in
`/docs/specs/rest-api-spec.md`.

---

# 11. WebSocket Gateway

Create `/backend/src/ws/websocket-gateway.ts`:

```ts
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "../config/auth";
import { handleTableMessage } from "./table-messages";
import { handleChatMessage } from "./chat-messages";

export function setupWebSocketGateway(io: Server) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("UNAUTHORIZED"));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.sub;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`Socket connected: ${userId}`);

    socket.on("message", async (msg) => {
      // Generic handler if you want one entrypoint
      // or split messages by type:
      if (msg?.type?.startsWith("CHAT_")) {
        await handleChatMessage(io, socket, msg);
      } else {
        await handleTableMessage(io, socket, msg);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${userId}`);
    });
  });
}
```

Then implement `table-messages.ts` and `chat-messages.ts` to follow
`/docs/specs/websocket-protocol.md`.

---

# 12. NPM Scripts

In `/backend/package.json`:

```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  }
}
```

---

# 13. Running the Backend

From `/backend`:

```bash
npm run dev
```

Backend should run on `http://localhost:4000` and WebSocket on `ws://localhost:4000` (Socket.IO).

---

# 14. Next Steps

* Implement the Game Engine per `/docs/specs/game-engine-spec.md`.
* Wire engine to services (`game.service.ts`).
* Implement REST & WS endpoints per:

  * `/docs/specs/rest-api-spec.md`
  * `/docs/specs/websocket-protocol.md`
* Add tests for:

  * Engine
  * REST API
  * WS flows

````

---