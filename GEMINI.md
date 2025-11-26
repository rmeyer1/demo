# GEMINI.md - Project Overview

This document provides a comprehensive overview of the Texas Hold'em Home Game Platform, intended to be used as a context for AI-driven development and analysis.

## 1. Project Overview

This is a full-stack, monorepo project for a real-time, online Texas Hold'em poker game. The system is designed to be server-authoritative, ensuring security and integrity of the game logic.

-   **Backend**: A Node.js application written in TypeScript.
    -   **Framework**: Appears to be [Fastify](https://www.fastify.io/) (based on `backend/README.md`).
    -   **Real-time**: Uses a WebSocket gateway (likely with Socket.IO) for handling live gameplay and chat.
    -   **Database**: Supabase (Postgres) with [Prisma](https://www.prisma.io/) as the ORM.
    -   **Asynchronous Jobs**: Uses BullMQ for background job processing (e.g., game state updates), handled by a separate worker process.
    -   **Caching**: Leverages Redis for caching table state and for Pub/Sub to coordinate between multiple backend instances.

-   **Frontend**: A modern web application.
    -   **Framework**: [Next.js 16](https://nextjs.org/) with React 19 (using the App Router).
    -   **Styling**: [Tailwind CSS](https://tailwindcss.com/).
    -   **Authentication**: [Supabase Auth](https://supabase.com/auth).
    -   **Data Fetching**: [React Query](https://tanstack.com/query/latest) for managing server state.
    -   **Real-time**: Connects to the backend WebSocket server for live game updates.

-   **Architecture**: The project follows a clean, decoupled architecture with a clear separation of concerns between the frontend, backend REST API, WebSocket gateway, and the core game engine. The documentation is extensive and well-maintained in the `/docs` directory.

## 2. Building and Running

### 2.1. One-Step Setup

The simplest way to get the entire environment running is to use the provided bootstrap script from the root of the repository.

```bash
# This script should handle environment file setup, dependency installation,
# and database migrations for both frontend and backend.
./scripts/bootstrap-local.sh
```

### 2.2. Manual Setup & Running

#### Backend

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Setup environment variables:**
    ```bash
    cp .env.example .env
    # Then fill in the required values in .env
    ```
4.  **Run database migrations:**
    ```bash
    npm run prisma:migrate
    ```
5.  **Seed the database (optional):**
    ```bash
    npm run seed
    ```
6.  **Start the development server:**
    ```bash
    npm run dev
    ```
7.  **Start the BullMQ worker (in a separate terminal):**
    ```bash
    npm run worker
    ```

#### Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Setup environment variables:**
    ```bash
    # Create a .env.local file and add the necessary variables
    # (see frontend/README.md for details)
    ```
4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:3000`.

### 2.3. Testing

The backend uses [Vitest](https://vitest.dev/) for testing.

```bash
# In the backend directory
# (TODO: Confirm the exact test command from package.json, e.g., "npm test")
npm test
```

## 3. Development Conventions

-   **Language**: The entire project (both frontend and backend) is written in **TypeScript**.
-   **Server-Authoritative Logic**: All game logic is handled exclusively by the backend's pure TypeScript game engine (`backend/src/engine`). The frontend is only responsible for rendering state and sending user actions.
-   **API Layers**: The backend exposes two layers of API: a **REST API** for stateless actions (lobby, auth, dashboards) and a **WebSocket API** for real-time, stateful gameplay.
-   **Database**: All database interactions are managed through the **Prisma ORM**. Changes to the schema should be accompanied by a new migration file.
-   **Code Style**: The project is configured with ESLint. Adhere to the existing linting rules.
-   **Documentation**: The `/docs` directory is the source of truth for architecture, API specifications, and system design. Any significant changes should be reflected in the documentation.
-   **State Management (Frontend)**: Client-side state is managed with standard React hooks, while server-side state (queries and mutations) is handled by **React Query**.
-   **Component-Based UI**: The frontend is built with reusable React components, organized by feature (e.g., `table`, `chat`, `dashboard`).
