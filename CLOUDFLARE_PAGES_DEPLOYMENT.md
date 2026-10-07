# Cloudflare Pages Deployment Guide

This guide walks you through deploying the HeroByte client to Cloudflare Pages.

## Prerequisites

- GitHub repository with the HeroByte code
- Cloudflare account (free tier works)
- Server already deployed on Render (or another platform)

## Step 1: Create a Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **Create application** → **Pages**
3. Click **Connect to Git**
4. Select your repository (`loshunter/HeroByte`)
5. Click **Begin setup**

## Step 2: Configure Build Settings

### Basic Settings

- **Project name**: `herobyte` (or your preferred name)
- **Production branch**: `main`

### Build Configuration

Click **Show advanced** and configure:

- **Root directory (advanced)**: `apps/client`
  - This tells Cloudflare to build from the monorepo's client directory

- **Build command**:

  ```bash
  corepack enable && pnpm install --frozen-lockfile && pnpm build
  ```

  - `corepack enable` ensures pnpm is available in the build environment
  - `--frozen-lockfile` ensures exact dependency versions from pnpm-lock.yaml
  - `pnpm build` builds the shared package and the client, then (on Cloudflare only) the website
    and the `/play/` layout (see below)

- **Build output directory**: `dist`
  - Vite outputs the built files to the `dist` directory

### Environment Variables

Add the following environment variable to **both Production and Preview**:

| Variable Name | Value                                |
| ------------- | ------------------------------------ |
| `VITE_WS_URL` | `wss://herobyte-server.onrender.com` |

**Important**:

- Use `wss://` (WebSocket Secure) not `ws://` for production
- Set this for both Production and Preview environments so preview deployments also work

### What the build serves: the website at `/`, the app at `/play/`

One Pages project serves both. On Cloudflare (Pages sets `CF_PAGES=1` in its build environment,
production and preview builds alike), `pnpm build`
ends with `apps/client/scripts/assemble-pages.mjs`, which builds the website (`site/build.mjs`) and lays
out `dist/` as:

- `/` and `/help/...`: the website (its own files under `/site-assets/` and `/img/`).
- `/play/`: the app's page. Its bundle stays at `/assets/` and its public files (`/tokens/`, `/tiles/`,
  `/sfx/`, `/manifest.json`, `/sw.js`) stay at the root, because saved tables and backups hold those URLs.
- Old links such as `/?room=<code>` still reach the table: the landing page forwards any link carrying
  one of the app's query parameters (`room`, `sessionUid`, `mobile`, `ws`) to `/play/` with the same query.
- A bare `/` opens the website, not a table. That includes the default table's (Main Hall's) invite
  link from before this layout, which was the bare address; its **Open HeroByte** button goes to the app.
- An installed HeroByte app (home screen or desktop) is always forwarded to `/play/`. The manifest's
  `start_url` is `/play/` with `id` and `scope` kept at `/`, but browsers re-read it on their own
  schedule and iOS keeps the address an icon was added with, so the forward covers installs that
  still open `/`.

In CI and Lighthouse the step runs but only logs that it skipped; dev and e2e never run it. Either
way the app stays at `/` there. To see the Cloudflare
layout locally, run `pnpm --filter herobyte-client build:pages` (set `VITE_WS_URL=ws://localhost:8787`
first to use a local server) and serve `apps/client/dist` with any static server. A top-level name
that both the site and the app have (other than `index.html`), or a site entry named `play`, stops
the build rather than overwriting one with the other. The site's `404.html` turns off Pages'
single-page-app fallback, so an unknown address gets a real "Page not found" page.

## Step 3: Deploy

1. Click **Save and Deploy**
2. Cloudflare Pages will:
   - Clone your repository
   - Install dependencies with pnpm
   - Build the client application
   - Deploy to a global CDN

The initial deployment takes 2-5 minutes.

## Step 4: Test Your Deployment

1. Once deployed, Cloudflare will provide a URL like: `https://herobyte.pages.dev`
2. Open the URL in your browser: the website. **Open HeroByte** (or `/play/`) is the app
3. In the app, the client should connect to your Render server via WebSocket
4. Test basic functionality:
   - Add tokens to the map
   - Move tokens around
   - Draw on the canvas
   - Roll dice

## Troubleshooting

### Build Fails

If the build fails, check:

- The build logs in Cloudflare Pages dashboard
- Ensure `Root directory` is set to `apps/client`
- Verify the build command is correct

### WebSocket Connection Fails

If the app loads but doesn't connect:

- Check browser console for errors (F12)
- Verify `VITE_WS_URL` is set correctly in Cloudflare Pages settings
- Ensure your Render server is running
- Confirm you're using `wss://` not `ws://`

### Blank Page

If you see a blank page:

- Check browser console (F12) for JavaScript errors
- Verify the build output directory is `dist`
- Check that the build succeeded in Cloudflare Pages logs

## Custom Domain (Optional)

To use your own domain:

1. In Cloudflare Pages → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Cloudflare automatically provisions SSL certificates

## Continuous Deployment

Every time you push to the `main` branch, Cloudflare Pages will automatically:

1. Detect the push
2. Run the build
3. Deploy the new version

You can also create preview deployments for other branches in the Pages settings.

## Performance

Cloudflare Pages provides:

- **Global CDN**: Your app is served from 275+ edge locations worldwide
- **Automatic SSL**: HTTPS is enabled by default
- **Unlimited bandwidth**: No bandwidth charges on the free tier
- **Fast builds**: Typical build times are 1-3 minutes
- **Instant rollbacks**: Revert to any previous deployment with one click

## Next Steps

- Set up a custom domain
- Configure branch preview deployments for testing
- Monitor deployment logs in the Cloudflare dashboard
- Consider enabling Cloudflare Web Analytics
