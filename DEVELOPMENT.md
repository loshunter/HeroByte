# Development Workflow

This guide explains how to work on HeroByte locally while keeping your live production deployment safe.

## Branch Strategy

- **`main`**: Production branch - automatically deploys to:
  - Server: Render (https://herobyte-server.onrender.com)
  - Client: Cloudflare Pages (https://herobyte.pages.dev)

- **`dev`**: Development branch - for local testing and experimental features

## Local Development Setup

### 1. Start the Server

In one terminal:

```bash
cd apps/server
pnpm dev
```

Server runs on `http://localhost:8787`

### 2. Start the Client

In another terminal:

```bash
cd apps/client
pnpm dev
```

Client runs on `http://localhost:5173`

The client automatically connects to `ws://localhost:8787` in development mode.

### 3. Test Your Changes

- Open http://localhost:5173 in your browser
- Make changes to code - Vite will hot-reload the client
- Server changes require restart (or use tsx watch mode)

## Making Changes

### Working on Features

```bash
# Switch to dev branch
git checkout dev

# Make your changes...
# Test locally with pnpm dev

# Commit your changes
git add .
git commit -m "Description of changes"

# Push to dev branch
git push origin dev
```

### Deploying to Production

Only merge to `main` when you're ready to deploy:

```bash
# Make sure dev is working
git checkout dev
# Test locally...

# Merge to main
git checkout main
git merge dev

# Push to trigger automatic deployment
git push origin main
```

**Important**: Pushing to `main` automatically deploys to production!

## Environment Variables

### Local Development
No environment variables needed - the client auto-connects to localhost.

### Production (Cloudflare Pages)
- `VITE_WS_URL` = `wss://herobyte-server.onrender.com`

## Workflow Examples

### Example: Adding a New Feature

```bash
# 1. Switch to dev
git checkout dev

# 2. Start both server and client
cd apps/server && pnpm dev &
cd apps/client && pnpm dev &

# 3. Make changes and test at localhost:5173

# 4. Commit when ready
git add .
git commit -m "Add new feature"
git push origin dev

# 5. Deploy to production when tested
git checkout main
git merge dev
git push origin main
```

### Example: Emergency Hotfix

```bash
# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug

# 2. Fix the bug and test locally

# 3. Merge directly to main
git checkout main
git merge hotfix/critical-bug
git push origin main

# 4. Also merge back to dev
git checkout dev
git merge main
git push origin dev
```

## Monitoring Production

- **Server logs**: Check Render dashboard
- **Client**: Cloudflare Pages dashboard shows build logs
- **Errors**: Check browser console on herobyte.pages.dev

## Tips

- **Keep dev and main in sync**: Regularly merge main into dev to avoid conflicts
- **Test before deploying**: Always test on localhost before pushing to main
- **Check builds**: Cloudflare Pages shows build status - make sure it's green
- **Server restarts**: Render automatically restarts server on deploy (takes ~2 min)

## Troubleshooting

### Client can't connect to local server
- Make sure server is running: `cd apps/server && pnpm dev`
- Check console shows: `[Config] WebSocket URL: ws://localhost:8787`

### Changes not appearing
- Client: Vite should auto-reload - check terminal for errors
- Server: Restart the server with `pnpm dev`

### Production broken after deploy
```bash
# Quick rollback
git checkout main
git revert HEAD
git push origin main
```

## Project Structure

```
HeroByte/
├── apps/
│   ├── client/          # React + Vite frontend
│   │   └── src/
│   │       └── config.ts   # Auto-detects dev vs prod
│   └── server/          # Node.js WebSocket server
│       └── src/
│           └── index.ts
├── packages/
│   └── shared/          # Shared TypeScript types
└── pnpm-workspace.yaml  # Monorepo config
```

## Current Line Count

~4,370 lines of TypeScript/JavaScript code
