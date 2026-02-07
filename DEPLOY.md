# Deployment Guide

This guide covers deploying the Texas Hold'em Poker App using **Render for the backend** and **Vercel for the frontend**.

## Architecture Overview

- **Backend (Render)**: Node.js API + WebSocket server + Redis
- **Frontend (Vercel)**: Next.js static site
- **Database**: Supabase (PostgreSQL)
- **Cache**: Render Managed Redis

---

## Prerequisites

1. [Render](https://render.com) account
2. [Vercel](https://vercel.com) account
3. [Supabase](https://supabase.com) project (for database + auth)
4. Code pushed to GitHub

---

## Deployment Steps (Two-Step Process)

### Step 1: Deploy Backend to Render

This must be done first to get the backend URL.

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select the repository and branch
5. Render will read `render.yaml` and create:
   - `poker-backend` (Node.js WebSocket server) - **$7/mo starter plan**
   - `poker-redis` (Managed Redis) - **Free tier**

6. **Set required environment variables** in Render Dashboard:
   - `DATABASE_URL` - Your Supabase PostgreSQL connection string
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - From Supabase Project Settings > API
   - `SUPABASE_JWT_SECRET` - From Supabase Project Settings > API > JWT Settings

7. Wait for deployment to complete (check logs for `Server running on port X`)

8. **Copy your backend URL**: `https://poker-backend-xxx.onrender.com`

---

### Step 2: Set FRONTEND_URL Environment Variable in Render

After you get your Vercel URL (in Step 3), come back and set this:

1. In Render Dashboard, go to `poker-backend` service
2. Navigate to **Environment** tab
3. Add environment variable:
   - `FRONTEND_URL` = `https://your-app.vercel.app` (from Step 3)
4. The service will auto-redeploy

---

### Step 3: Deploy Frontend to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend` (or leave blank if repo is just the frontend)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Set environment variables**:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://poker-backend-xxx.onrender.com` (from Step 1)
   - `NEXT_PUBLIC_WS_URL` = `wss://poker-backend-xxx.onrender.com`
   - `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase anon/public key

6. Click **Deploy**

7. **Copy your Vercel URL**: `https://your-app.vercel.app`

---

### Step 4: Complete the Loop

1. Return to Render Dashboard (Step 2)
2. Set `FRONTEND_URL` to your Vercel URL
3. This enables CORS properly

---

## File Reference

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint (backend + Redis only) |
| `vercel.json` | Vercel build configuration |
| `frontend/.env.production` | Template for Vercel env vars |
| `DEPLOY.md` | This file |

---

## WebSocket Configuration

WebSockets work on Render's Node.js services without special configuration. The backend:

- Uses the same port for HTTP and WebSocket (Render requirement)
- Automatically upgrades connections at `/ws/*` paths
- Handles CORS based on `FRONTEND_URL` env var

---

## Troubleshooting

### WebSocket Connection Fails
- Verify `WS_URL` matches your Render backend URL (with `wss://`)
- Check that `FRONTEND_URL` is set correctly in Render
- Ensure no firewall/VPN blocking WebSocket connections

### CORS Errors
- Make sure `FRONTEND_URL` in Render matches your actual Vercel URL exactly
- Check for trailing slashes (should not have them)

### Redis Connection Issues
- Redis URL is auto-populated from the Render Redis service
- Verify the `poker-redis` service is created and running

### Build Fails on Vercel
- Check that `vercel.json` is in the repository root
- Verify `dist` folder is created during build
- Ensure all `NEXT_PUBLIC_` env vars are set before build

---

## Cost Overview

| Service | Plan | Monthly Cost |
|---------|------|--------------|
| Render Backend | Starter (always-on) | ~$7 |
| Render Redis | Starter (free tier) | $0 |
| Vercel Frontend | Hobby | $0 |
| Supabase | Free tier | $0 |

**Total: ~$7/month** for the always-on backend + free frontend, Redis, and database.

---

## Post-Deployment Checklist

- [ ] Backend deployed on Render with health check passing
- [ ] Redis service created and connected
- [ ] `FRONTEND_URL` set in Render environment
- [ ] Frontend deployed on Vercel
- [ ] Environment variables set in Vercel
- [ ] WebSocket connection test successful
- [ ] Game room creation works
- [ ] User authentication via Supabase works
