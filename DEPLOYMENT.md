# HeroByte Deployment Guide

## Overview

This guide covers deploying HeroByte to production using:

- **Render** for the WebSocket server
- **Cloudflare Pages** (free CDN) for the client

> ### How the live HeroByte runs today
>
> The production deployment is on a **paid Render plan with a persistent disk**. That means, for
> the live service:
>
> - **No idle spin-down and no cold start** — the server stays warm.
> - **On-disk state survives restarts and redeploys**: room state, uploaded assets, Map Studio
>   documents and hashed room/DM passwords all live on the mounted disk (see §1F).
> - **Private rooms are durable.** The old caveat — custom tables losing their password on every
>   restart — was a consequence of the free tier's ephemeral filesystem and no longer applies.
>
> Sections below that discuss the **free tier** are kept for anyone deploying their **own** copy
> cheaply. They do not describe this deployment.
>
> Still true regardless of plan: **pushing `main` auto-deploys** (Render watches `main` from its
> own dashboard, so a push is not gated by CI — prefer a PR from `dev`), and **players must
> reload after a deploy**, because a stale tab mishandles the post-restart sync.

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

| Setting            | Value                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **Name**           | `herobyte-server` (or your choice)                                                                    |
| **Root Directory** | `apps/server`                                                                                         |
| **Environment**    | `Node`                                                                                                |
| **Region**         | `US East (Ohio)` (lowest average US latency)                                                          |
| **Branch**         | `main`                                                                                                |
| **Build Command**  | `pnpm install --frozen-lockfile && pnpm build`                                                        |
| **Start Command**  | `pnpm start`                                                                                          |
| **Instance Type**  | Paid instance + persistent disk (what HeroByte runs — see §1E/§1F). `Free` works for a personal copy. |

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

### E. Notes on Render plans

**This deployment runs a paid plan with a persistent disk** — it stays warm and keeps its data
across restarts. The heartbeat below applies on any plan.

- WebSocket timeout: the server includes a 25-second ping/pong heartbeat to prevent disconnection.

**If you deploy your own copy on the free tier instead**, expect:

- **750 instance hours/month** per workspace (enough for one 24/7 service)
- Services spin down after 15 minutes of inactivity
- Cold starts take ~30 seconds when the service wakes up
- An **ephemeral filesystem** — see §1F for what that costs you and how a disk fixes it

### F. Server Environment Variables (complete reference)

Every variable the server reads. All are optional; the defaults run a working dev server.

| Variable                            | Default                                            | Purpose                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                              | `8787`                                             | HTTP + WebSocket listen port. Render sets this automatically.                                                                                                                   |
| `HEROBYTE_ROOM_SECRET`              | `Fun1` (dev fallback, warns)                       | Default room's entry password (6–128 chars). Seeds the secret file on first boot; after that, DM-set passwords in the file win.                                                 |
| `HEROBYTE_DM_PASSWORD`              | `FunDM` (dev fallback, warns)                      | Default room's DM elevation password (8–128 chars).                                                                                                                             |
| `HEROBYTE_ALLOWED_ORIGINS`          | localhost dev ports + `https://herobyte.pages.dev` | Comma-separated origin allowlist for HTTP/WebSocket. `*` disables the check (not recommended).                                                                                  |
| `HEROBYTE_DEFAULT_ROOM_ID`          | `default`                                          | Room id of the default table.                                                                                                                                                   |
| `HEROBYTE_MAX_CUSTOM_ROOMS`         | `500`                                              | Cap on private rooms (bounds the pre-auth `create-room` flood).                                                                                                                 |
| `HEROBYTE_DEMO_MODE`                | off                                                | `true` renders the fallback room password in plaintext on the HTTP landing page. Demo servers only.                                                                             |
| `HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS` | `1`                                                | How long the default table may sit empty before the server wipes it, while it still uses the published password (see §4). **Set `0` to disable.**                               |
| `HEROBYTE_DATA_DIR`                 | the `apps/server` package root                     | **The persistent-disk lever.** Re-anchors every on-disk store default below onto one directory. Set in production to the Render disk's mount path; always use an absolute path. |
| `HEROBYTE_ASSET_DIR`                | `<data dir>/herobyte-assets/`                      | Uploaded-image store directory (content-addressed, 200MB quota).                                                                                                                |
| `HEROBYTE_MAP_STORE_FILE`           | `<data dir>/herobyte-maps.json`                    | Map Studio document store.                                                                                                                                                      |
| `ROOM_STATE_FILE`                   | `<data dir>/herobyte-state.json`                   | The DEFAULT room's state file (exists for parallel E2E runs). Custom rooms always write `herobyte-state.<roomId>.json` in the data dir.                                         |
| `ROOM_STORE`                        | in-memory                                          | `redis` backs room state with Redis instead of process memory + JSON files.                                                                                                     |
| `REDIS_URL`                         | `redis://127.0.0.1:6379`                           | Redis connection string when `ROOM_STORE=redis`.                                                                                                                                |
| `FEATURE_FLAG_DELTAS`               | enabled                                            | `false` disables the delta sync channel (full snapshots only).                                                                                                                  |
| `FEATURE_FLAG_ACKS`                 | enabled                                            | `false` disables command acknowledgements.                                                                                                                                      |
| `FEATURE_FLAG_DRAG_PREVIEWS`        | enabled                                            | `false` disables live drag previews.                                                                                                                                            |
| `HEROBYTE_E2E`                      | off                                                | `true` enables the test-only state-reset endpoint. Never set in production.                                                                                                     |

**On-disk stores.** The server persists four things, all JSON/files in the data dir (`HEROBYTE_DATA_DIR`, else the `apps/server` package root — deliberately NOT the process CWD, so the stores don't fork if the launch directory changes):

| Store                                                  | What's in it                                  | Path override                         |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------------------- |
| `herobyte-state.json` / `herobyte-state.<roomId>.json` | Room state (tokens, drawings, scene) per room | `ROOM_STATE_FILE` (default room only) |
| `herobyte-assets/`                                     | Uploaded images, content-addressed by hash    | `HEROBYTE_ASSET_DIR`                  |
| `herobyte-maps.json`                                   | Map Studio documents                          | `HEROBYTE_MAP_STORE_FILE`             |
| `herobyte-room-secret.json`                            | Hashed room + DM passwords                    | — (follows the data dir)              |

**Mounting a persistent disk (Render paid plan):** add a disk (e.g. mounted at `/var/data`), set `HEROBYTE_DATA_DIR=/var/data`, redeploy. All four stores land on the mount; nothing else to configure. Do NOT mount at `apps/server` — it would shadow the app.

**The live HeroByte deployment does this**, so all four stores above are durable in production. Without a disk (e.g. a free-tier copy), the ephemeral filesystem wipes all four on every spin-down or redeploy — which also means custom rooms lose their saved passwords and have to be re-minted.

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

### Cold Start Delays (free-tier copies only)

**Not applicable to this deployment** — it runs a paid plan and stays warm. If you are running
your own free-tier copy:

- Free-tier services spin down after 15 minutes of inactivity
- The first request after spin-down takes ~30 seconds
- A paid plan removes the spin-down entirely

### Session State Persistence

- The server persists state to JSON files and an asset directory (see section 1F).
- **This deployment mounts a persistent disk**, so that state survives restarts and redeploys.
- A copy **without** a disk runs on an ephemeral filesystem — everything in §1F is wiped on every
  spin-down or redeploy. To make such a copy durable:
  - Render persistent disk: mount it and set `HEROBYTE_DATA_DIR` to the mount path — see §1F
  - Or Redis for room state: `ROOM_STORE=redis` + `REDIS_URL`
- Independently of the disk, DMs can Save/Load a complete session file from the client (it includes
  maps and uploaded images) — useful for backups and for moving a game between servers.

### The default table clears itself

The default table (**Main Hall**) is the one the documented fallback password opens, so on any
public deployment it is effectively an open scratch space. It is also the one room that is never
unloaded — it backs the legacy single-room surface. Left alone, that combination means everything
anyone drops there accumulates forever against its **50 MB per-room asset quota**, and once that
fills, every upload in that table returns HTTP 507 permanently. (On an ephemeral filesystem the
spin-down used to hide this; a persistent disk makes it stick.)

**The default table's passwords are immutable.** The server refuses `set-room-password` and
`set-dm-password` for it, so the published `HEROBYTE_ROOM_SECRET` / `HEROBYTE_DM_PASSWORD` always
work there. That is deliberate: they are the credentials every deployment publishes, so a mutable
password means one visitor can padlock a public demo and its host loses their own test bed with no
way back in — permanently, since the change persists to disk.

It follows that the table can never quietly become someone's real table, so it is **always** swept.
The server empties it in place once it has sat **empty of authenticated clients for 1 hour** — room
state, map documents, and its claim on uploaded images. Specifics worth knowing:

- **Private tables are never auto-cleared.** They unload after 30 minutes idle, which is lossless:
  durable state is flushed first and restored on the next join.
- A session is never interrupted: the sweep skips the table whenever anyone is connected to it.
- Uploads are content-addressed, so clearing **un-claims** rather than deletes — bytes another table
  also uploaded stay on disk and keep serving.
- The idle clock starts at boot, so a restart cannot wipe a table nobody has rejoined yet.
- Users keep work via **DM Menu → Session → Save as a Private Table** (`fork-table`), which copies
  the whole table into a fresh private one — including a co-claim on its uploads, so a later sweep
  of the source cannot delete images the copy still uses.

**Running a private server where the default table IS your table?** It will still be swept, because
its passwords cannot be changed. Either run your game on a private table, or disable the sweep:

```
HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS=0
```

Any other positive number sets the window in hours (fractions allowed, e.g. `0.5`).

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

**This deployment** runs a **paid Render plan with a persistent disk** (for 24/7 uptime and durable
state) plus **Cloudflare Pages on its free tier**. Check the Render dashboard for the current
instance and disk pricing — it varies by instance size and disk capacity, so it is deliberately not
quoted here.

**If you deploy your own copy**, the cheapest viable setup is:

| Service              | Free option | Limits of the free option                                   |
| -------------------- | ----------- | ----------------------------------------------------------- |
| **Render**           | Yes         | 750 hours/month, spin down after 15min idle, ephemeral disk |
| **Cloudflare Pages** | Yes         | Unlimited requests, 500 builds/month                        |

That runs at no cost, with the spin-down and data-loss caveats described in §1E, §1F and §4. Paying
for a Render instance plus a disk is what removes both.

---

## Quick Start Checklist

- [ ] Push code to GitHub
- [ ] Create Render Web Service
  - [ ] Set root directory: `apps/server`
  - [ ] Build: `pnpm install --frozen-lockfile && pnpm build`
  - [ ] Start: `pnpm start`
  - [ ] Add env: `NODE_ENV=production`
  - [ ] For durable state: attach a persistent disk (paid plan) and add env `HEROBYTE_DATA_DIR=<the disk's mount path>` — see §1F. Skip this and every store is ephemeral.
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
