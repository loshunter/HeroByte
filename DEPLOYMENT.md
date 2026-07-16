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

### F. Server Environment Variables (complete reference)

Every variable the server reads. All are optional; the defaults run a working dev server.

| Variable                    | Default                                             | Purpose                                                                                                                                                    |
| --------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                      | `8787`                                              | HTTP + WebSocket listen port. Render sets this automatically.                                                                                              |
| `HEROBYTE_ROOM_SECRET`      | `Fun1` (dev fallback, warns)                        | Default room's entry password (6–128 chars). Seeds the secret file on first boot; after that, DM-set passwords in the file win.                            |
| `HEROBYTE_DM_PASSWORD`      | `FunDM` (dev fallback, warns)                       | Default room's DM elevation password (8–128 chars).                                                                                                        |
| `HEROBYTE_ALLOWED_ORIGINS`  | localhost dev ports + `https://herobyte.pages.dev`  | Comma-separated origin allowlist for HTTP/WebSocket. `*` disables the check (not recommended).                                                             |
| `HEROBYTE_DEFAULT_ROOM_ID`  | `default`                                           | Room id of the default table.                                                                                                                              |
| `HEROBYTE_MAX_CUSTOM_ROOMS` | `500`                                               | Cap on private rooms (bounds the pre-auth `create-room` flood).                                                                                            |
| `HEROBYTE_DEMO_MODE`        | off                                                 | `true` renders the fallback room password in plaintext on the HTTP landing page. Demo servers only.                                                        |
| `HEROBYTE_DATA_DIR`         | the `apps/server` package root                      | **The persistent-disk lever.** Re-anchors every on-disk store default below onto one directory. Absolute paths recommended (e.g. a Render disk mount).     |
| `HEROBYTE_ASSET_DIR`        | `<data dir>/herobyte-assets/`                       | Uploaded-image store directory (content-addressed, 200MB quota).                                                                                           |
| `HEROBYTE_MAP_STORE_FILE`   | `<data dir>/herobyte-maps.json`                     | Map Studio document store.                                                                                                                                 |
| `ROOM_STATE_FILE`           | `<data dir>/herobyte-state.json`                    | The DEFAULT room's state file (exists for parallel E2E runs). Custom rooms always write `herobyte-state.<roomId>.json` in the data dir.                    |
| `ROOM_STORE`                | in-memory                                           | `redis` backs room state with Redis instead of process memory + JSON files.                                                                                |
| `REDIS_URL`                 | `redis://127.0.0.1:6379`                            | Redis connection string when `ROOM_STORE=redis`.                                                                                                           |
| `FEATURE_FLAG_DELTAS`       | enabled                                             | `false` disables the delta sync channel (full snapshots only).                                                                                             |
| `FEATURE_FLAG_ACKS`         | enabled                                             | `false` disables command acknowledgements.                                                                                                                 |
| `FEATURE_FLAG_DRAG_PREVIEWS`| enabled                                             | `false` disables live drag previews.                                                                                                                       |
| `HEROBYTE_E2E`              | off                                                 | `true` enables the test-only state-reset endpoint. Never set in production.                                                                                |

**On-disk stores.** The server persists four things, all JSON/files in the data dir (`HEROBYTE_DATA_DIR`, else the `apps/server` package root — deliberately NOT the process CWD, so the stores don't fork if the launch directory changes):

| Store                            | What's in it                                     | Path override           |
| -------------------------------- | ------------------------------------------------ | ----------------------- |
| `herobyte-state.json` / `herobyte-state.<roomId>.json` | Room state (tokens, drawings, scene) per room | `ROOM_STATE_FILE` (default room only) |
| `herobyte-assets/`               | Uploaded images, content-addressed by hash       | `HEROBYTE_ASSET_DIR`    |
| `herobyte-maps.json`             | Map Studio documents                             | `HEROBYTE_MAP_STORE_FILE` |
| `herobyte-room-secret.json`      | Hashed room + DM passwords                       | — (follows the data dir) |

**Mounting a persistent disk (Render paid tier):** add a disk (e.g. mounted at `/var/data`), set `HEROBYTE_DATA_DIR=/var/data`, redeploy. All four stores land on the mount; nothing else to configure. Without the disk, the free tier's ephemeral filesystem wipes all four on every spin-down.

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

- The server persists state to JSON files (see section 1F), but the free tier's filesystem is ephemeral — everything is wiped on spin-down/redeploy
- For durable state:
  - Render persistent disk (paid tier): mount it and set `HEROBYTE_DATA_DIR` to the mount path — see section 1F
  - Or Redis for room state: `ROOM_STORE=redis` + `REDIS_URL`
- As a stopgap, DMs can Save/Load a complete session file from the client (includes maps and uploaded images)

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
