# Poker Backend

Texas Hold'em Home Game Platform Backend

## Setup

1. (Optional) Run the one-command bootstrap from repo root:
```bash
./scripts/bootstrap-local.sh
```

2. Or do it manually:
```bash
cp ../.env.example ../.env
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
```

3. Seed demo data (two users + one table):
```bash
npm run seed
```

4. Seed Supabase-authenticated test users (auto-confirms email, also seeds table + seats):
```bash
npm run seed:test-users
```

> Requires `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, and `DATABASE_URL` to be set. No confirmation emails are sent; users are created in a verified state for automated tests.

4. Start the server:
```bash
npm run dev
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:studio` - Open Prisma Studio

## Architecture

- **REST API**: Fastify-based REST endpoints for table management, auth, dashboard, and chat history
- **WebSocket**: Socket.IO-based real-time communication for gameplay and chat
- **Database**: Supabase Postgres via Prisma ORM
- **Cache**: Redis for table state and pub/sub
- **Game Engine**: Pure TypeScript module for poker logic

## API Endpoints

See `/docs/specs/rest-api-spec.md` for full API documentation.

## WebSocket Protocol

See `/docs/specs/web-socket-protocol.md` for WebSocket message format.
