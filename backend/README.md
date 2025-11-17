# Poker Backend

Texas Hold'em Home Game Platform Backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```env
# Supabase
SUPABASE_URL=https://<your>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<supabase-jwt-secret>

# Postgres (Supabase DB)
DATABASE_URL=postgresql://postgres:<password>@db.<domain>.supabase.co:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Backend
PORT=4000
NODE_ENV=development
```

3. Set up Prisma:
```bash
npm run prisma:generate
npm run prisma:migrate
```

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

