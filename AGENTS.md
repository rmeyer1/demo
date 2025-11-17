# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Fastify + Socket.IO TypeScript API; Prisma schema in `backend/prisma/`; entry point `src/server.ts`.
- `frontend/`: Next.js 16 app router; pages in `frontend/app/`, shared UI in `frontend/components/`, utilities in `frontend/lib/`.
- `docs/`: Architecture notes and specs (REST, WebSocket, engine), setup guides, and test plans. Check here before altering flows.

## Build, Test, and Development Commands
- Backend: `cd backend && npm install` once, then `npm run dev` (watch mode), `npm run build` (tsc to `dist/`), `npm start` (run compiled). Database helpers: `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:studio`.
- Frontend: `cd frontend && npm install`, `npm run dev` (http://localhost:3000), `npm run build`, `npm start`, `npm run lint`.
- Scripts are split per package; run commands from the matching directory.

## Coding Style & Naming Conventions
- Language: TypeScript across frontend and backend.
- Formatting/lint: Frontend enforces ESLint (`npm run lint`). Match default Next.js/TypeScript ESLint rules; prefer named exports for shared components/hooks. Backend currently relies on `tsc`—follow idiomatic TS, 2-space indentation, and keep Fastify routes in feature-focused modules.
- Names: components/hooks in `PascalCase`/`camelCase`; Prisma models and DB tables follow existing schema names in `backend/prisma/schema.prisma`.

## Testing Guidelines
- Planned tools: Vitest for unit/service logic, Playwright for integration/E2E (see `docs/testing/*`). Add tests beside code (e.g., `backend/tests/unit/...`, `frontend/__tests__`).
- Keep new features gated by at least one automated test; prefer fast unit coverage before adding E2E flows.
- When adding Playwright specs, document fixtures and env requirements in the relevant `docs/testing` plan.

## Commit & Pull Request Guidelines
- Use concise, present-tense messages; Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `test:`) are encouraged for clarity.
- PRs should include: a one-line summary, bullet list of changes, test evidence (`npm run lint`, relevant test suites), and references to doc/spec updates. Include screenshots for UI-facing adjustments.
- Avoid committing secrets (`.env`, `.env.local`); use example files instead.

## Security & Configuration Tips
- Required env files: `backend/.env` (Supabase, Postgres, Redis) and `frontend/.env.local` (Supabase, API, WS URLs). Never commit them.
- Prisma migrations write to the connected DB; use a disposable database in feature branches and run `npm run prisma:migrate` only after reviewing the generated SQL.
