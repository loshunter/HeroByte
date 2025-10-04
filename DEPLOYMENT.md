# HeroByte Deployment Guide

## Overview

This guide covers deploying HeroByte to production using:

- **Render** (free web service) for the WebSocket server
- **Cloudflare Pages** (free CDN) for the client

## Prerequisites

- GitHub repository with your code pushed
- Render account (https://render.com)
- Cloudflare account (https://cloudflare.com)

---

## 1. Deploy Server to Render

### A. Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository

### B. Configure Service

| Setting            | Value                                          |
| ------------------ | ---------------------------------------------- |
| **Name**           | `herobyte-server` (or your choice)             |
| **Root Directory** | `apps/server`                                  |
| **Environment**    | `Node`                                         |
| **Region**         | `US East (Ohio)` (lowest average US latency)   |
| **Branch**         | `main`                                         |
| **Build Command**  | `pnpm install --frozen-lockfile && pnpm build` |
| **Start Command**  | `pnpm start`                                   |
| **Instance Type**  | `Free`                                         |

### C. Environment Variables

Add these in the **Environment** section:

```
NODE_ENV=production
```

### D. Deploy

1. Click **Create Web Service**
2. Wait for build to complete (~2-3 minutes)
3. Your server will be available at: `https://herobyte-server.onrender.com` (or your chosen name)
4. **Important**: Your WebSocket URL will be `wss://herobyte-server.onrender.com/` (note the `wss://` protocol and trailing `/`)

### E. Notes on Render Free Tier

- **750 instance hours/month** per workspace (enough for one 24/7 service)
- Services spin down after 15 minutes of inactivity
- Cold starts take ~30 seconds when service wakes up
- WebSocket timeout: The server includes a 25-second ping/pong heartbeat to prevent disconnection

---

## 2. Deploy Client to Cloudflare Pages

### A. Create Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Select your GitHub repository
4. Authorize Cloudflare to access your repo

### B. Configure Build Settings

| Setting                    | Value                                          |
| -------------------------- | ---------------------------------------------- |
| **Project name**           | `herobyte` (or your choice)                    |
| **Production branch**      | `main`                                         |
| **Build command**          | `pnpm install --frozen-lockfile && pnpm build` |
| **Build output directory** | `dist`                                         |

**Important - Advanced Settings:**

- Click **Build settings** → **Show advanced**
- Set **Root directory (advanced)** to: `apps/client`

### C. Environment Variables

Click **Environment variables** and add:

```
VITE_WS_URL=wss://herobyte-server.onrender.com/
```

Replace `herobyte-server.onrender.com` with your actual Render service URL from Step 1.

### D. Deploy

1. Click **Save and Deploy**
2. Wait for build to complete (~1-2 minutes)
3. Your app will be available at: `https://herobyte.pages.dev` (or your chosen name)

### E. Test Deployment

1. Open your Pages URL in a browser
2. The client should automatically connect to the Render WebSocket server
3. Test by:
   - Creating a token (should appear on map)
   - Opening dice roller
   - Drawing on the map
   - Testing with a friend on another device

---

## 3. Optional: Custom Domain

### For Cloudflare Pages:

1. In your Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `herobyte.yourdomain.com`)
4. Follow Cloudflare's instructions to update DNS

Cloudflare's proxy supports WebSockets automatically.

### For Render:

1. In your Render service → **Settings** → **Custom Domains**
2. Add your custom domain
3. Update your DNS CNAME to point to your Render service

Then update `VITE_WS_URL` in Cloudflare Pages to use your custom Render domain.

---

## 4. Troubleshooting

### WebSocket Connection Issues

- Ensure `VITE_WS_URL` in Cloudflare uses `wss://` (not `ws://`)
- Verify the URL ends with `/` (e.g., `wss://herobyte-server.onrender.com/`)
- Check Render logs for connection errors
- Test WebSocket directly: `wscat -c wss://your-server.onrender.com/`

### Build Failures on Render

- Check if `pnpm-lock.yaml` is committed to git
- Verify `apps/server/package.json` has `"type": "module"`
- Check build logs in Render dashboard

### Build Failures on Cloudflare Pages

- Verify **Root directory** is set to `apps/client`
- Check that `VITE_WS_URL` environment variable is set
- Verify build output directory is `dist`
- Check build logs in Cloudflare dashboard

### Cold Start Delays (Render Free Tier)

- Free tier services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Consider upgrading to paid tier ($7/month) for 24/7 availability

### Session State Persistence

- Current setup stores game state in memory
- State is lost when Render restarts (cold starts)
- For production, consider:
  - Using Render's persistent disk (paid tier)
  - Adding a database (e.g., Render PostgreSQL, Cloudflare D1)
  - Using Redis for session storage

---

## 5. Monitoring

### Render Metrics

- View logs: Render Dashboard → Your Service → **Logs**
- Monitor uptime and response times in **Metrics** tab
- Set up alerts in **Settings** → **Alerts**

### Cloudflare Analytics

- View traffic: Pages Dashboard → Your Project → **Analytics**
- See bandwidth, requests, and performance metrics
- Check **Functions** tab for any edge function errors

---

## 6. Updating Deployments

### Render (Server)

- Push changes to GitHub
- Render auto-deploys on git push (if auto-deploy enabled)
- Or manually deploy: Service → **Manual Deploy** → **Deploy latest commit**

### Cloudflare Pages (Client)

- Push changes to GitHub
- Pages auto-deploys on git push
- Or manually redeploy: Project → **Deployments** → **Retry deployment**

---

## 7. Architecture Diagram

```
┌─────────────────┐         wss://          ┌──────────────────┐
│   Browser       │ ──────────────────────► │  Render Server   │
│  (Cloudflare    │                         │  (WebSocket +    │
│   Pages CDN)    │ ◄────────────────────── │   HTTP)          │
└─────────────────┘      Real-time sync     └──────────────────┘
        │                                              │
        │                                              │
    HTTPS/WSS                                    wss:// (port 443)
    Global CDN                                   US-East region
```

---

## 8. Cost Breakdown

| Service              | Free Tier | Limits                                      |
| -------------------- | --------- | ------------------------------------------- |
| **Render**           | Yes       | 750 hours/month, spin down after 15min idle |
| **Cloudflare Pages** | Yes       | Unlimited requests, 500 builds/month        |

**Total monthly cost: $0** (within free tier limits)

**Upgrade options:**

- Render paid: $7/month (24/7 uptime, no spin down)
- Cloudflare Pages Pro: $20/month (advanced analytics, faster builds)

---

## Quick Start Checklist

- [ ] Push code to GitHub
- [ ] Create Render Web Service
  - [ ] Set root directory: `apps/server`
  - [ ] Build: `pnpm install --frozen-lockfile && pnpm build`
  - [ ] Start: `pnpm start`
  - [ ] Add env: `NODE_ENV=production`
- [ ] Note Render URL (e.g., `https://herobyte-server.onrender.com`)
- [ ] Create Cloudflare Pages Project
  - [ ] Set root directory: `apps/client`
  - [ ] Build: `pnpm install --frozen-lockfile && pnpm build`
  - [ ] Output: `dist`
  - [ ] Add env: `VITE_WS_URL=wss://[your-render-url]/`
- [ ] Test deployment
- [ ] Share with friends!

---

## Support

If you encounter issues:

1. Check Render logs for server errors
2. Check browser console for client errors
3. Verify WebSocket connection in Network tab
4. Test locally first: `pnpm dev` from project root

Happy gaming! 🎲
