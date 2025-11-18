# Frontend - Texas Hold'em Home Game Platform

This is the frontend application for the Texas Hold'em Home Game Platform, built with Next.js, React, and Tailwind CSS.

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **React 19**
- **Tailwind CSS 4**
- **Supabase** (for authentication)
- **Socket.IO Client** (for real-time gameplay and chat)
- **React Query** (for data fetching)
- **Zod** (for validation)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file (see `.env.local.example` for template):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   NEXT_PUBLIC_WS_URL=ws://localhost:4000
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
  app/                    # Next.js App Router pages
    auth/                 # Authentication pages
    lobby/                 # Lobby page
    table/[id]/           # Table gameplay page
    dashboard/            # Dashboard page
  components/             # React components
    layout/               # Layout components
    ui/                   # Reusable UI components
    table/                # Poker table components
    chat/                 # Chat components
    dashboard/            # Dashboard components
  hooks/                  # Custom React hooks
  lib/                    # Utility libraries
    supabaseClient.ts     # Supabase client
    apiClient.ts          # REST API client
    wsClient.ts           # WebSocket client
    types.ts              # TypeScript types
```

## Features

- **Authentication**: Login and registration with Supabase
- **Lobby**: Create and join poker tables
- **Gameplay**: Real-time poker table with WebSocket updates
- **Chat**: Integrated chat system during games
- **Dashboard**: Player performance metrics and statistics

## Development

- The app uses a dark theme optimized for poker gameplay
- All game logic is server-authoritative (frontend only displays state)
- WebSocket connections are managed automatically via hooks
- React Query handles caching and data fetching

## Environment Variables

See `.env.local.example` for required environment variables. Never commit `.env.local` to version control.  





