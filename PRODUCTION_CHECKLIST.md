# Production Deployment Checklist

Use this checklist before deploying to production to catch issues early.

## Pre-Deployment Checks

### 1. Environment Configuration

**Cloudflare Pages:**

- [ ] `VITE_WS_URL=wss://herobyte-server.onrender.com` (Production)
- [ ] `VITE_WS_URL=wss://herobyte-server.onrender.com` (Preview)
- [ ] `NODE_VERSION=20` (optional)

**Render:**

- [ ] `PORT` is auto-assigned by Render (no action needed)

### 2. Local Testing

- [ ] Run `pnpm dev` and test at http://localhost:5173
- [ ] Check browser console shows: `[Config] WebSocket URL: ws://localhost:8787`
- [ ] Verify WebSocket connects (check Network tab)
- [ ] Test core features:
  - [ ] Add/move tokens
  - [ ] Draw on canvas
  - [ ] Roll dice
  - [ ] Voice chat (if testing with 2+ devices)
  - [ ] Portrait upload
  - [ ] Portrait persists after refresh

### 3. Build Verification

- [ ] Server builds successfully: `pnpm build:server`
- [ ] Client builds successfully: `pnpm --filter herobyte-client build` (CI/CD runs this exact command before packaging `apps/client/dist`)
- [ ] No TypeScript errors
- [ ] No build warnings (or all are known/acceptable)

### 4. Code Quality

- [ ] All changes committed to `dev` branch
- [ ] Git status is clean: `git status`
- [ ] No debug console.logs left in production code
- [ ] No commented-out code blocks

## Deployment Steps

### 1. Final Local Test

```bash
# From repo root
git checkout dev
pnpm dev
# Test thoroughly at localhost:5173
```

### 2. Merge to Main

```bash
git checkout main
git merge dev
git push origin main
```

### 3. Monitor Deployments

**Render (Server):**

- [ ] Check Render dashboard for build status
- [ ] Wait for "Live" status (~2 minutes)
- [ ] Check logs for errors
- [ ] Test health endpoint: https://herobyte-server.onrender.com/healthz (should return "ok")

**Cloudflare Pages (Client):**

- [ ] Check Pages dashboard for build status
- [ ] Wait for "Success" status (~2-3 minutes)
- [ ] Check build logs for errors

### 4. Production Smoke Test

- [ ] Open https://herobyte.pages.dev
- [ ] Check browser console shows: `[Config] WebSocket URL: wss://herobyte-server.onrender.com`
- [ ] Verify WebSocket connects (Network tab should show wss:// connection)
- [ ] Test from multiple devices/browsers:
  - [ ] Desktop browser
  - [ ] Mobile browser
  - [ ] Different network (not just localhost)

**Core Features:**

- [ ] Add token
- [ ] Move token
- [ ] Recolor token
- [ ] Draw on canvas (freehand, shapes)
- [ ] Erase drawings
- [ ] Clear all drawings
- [ ] Roll dice
- [ ] View roll history
- [ ] Upload portrait
- [ ] Refresh page - portrait persists
- [ ] Voice chat with 2+ clients
- [ ] Measure tool
- [ ] Pointer tool

### 5. Performance Checks

- [ ] No Konva warnings in console (should be 3 layers, not 6)
- [ ] Page loads quickly (<3 seconds)
- [ ] WebSocket connection is stable (no disconnects)
- [ ] Portrait images load properly
- [ ] Map background loads properly
- [ ] No memory leaks (keep DevTools open for 5+ minutes)

### 6. Cross-Device Testing

- [ ] Test on 2+ devices simultaneously
- [ ] Verify changes sync between devices
- [ ] Check voice chat works across devices
- [ ] Verify portraits display on all devices

## Post-Deployment

### Monitor for Issues

**First 5 minutes:**

- Watch Render logs for errors
- Check for WebSocket connection failures
- Monitor for unusual traffic

**First hour:**

- Check for user reports (if applicable)
- Monitor server CPU/memory on Render
- Check error logs

### Rollback Plan (If Needed)

If critical issues are found:

```bash
# Quick revert
git checkout main
git revert HEAD
git push origin main

# This triggers automatic rollback on both Render and Cloudflare Pages
```

## Common Issues & Solutions

### Issue: WebSocket won't connect in production

**Check:**

- [ ] VITE_WS_URL uses `wss://` not `ws://`
- [ ] Server is running on Render
- [ ] CORS/Origin headers allow Cloudflare Pages domain

### Issue: Portrait disappears after refresh

**Check:**

- [ ] Server has `saveState()` called after portrait update
- [ ] Server state file is persisted (check Render persistent disk if configured)

### Issue: Cloudflare Pages build fails

**Check:**

- [ ] Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
- [ ] Root directory: `apps/client`
- [ ] Output directory: `dist`
- [ ] pnpm-lock.yaml is committed and up-to-date

### Issue: Render build fails

**Check:**

- [ ] Build command: `pnpm install --prod=false && pnpm --filter vtt-server build`
- [ ] Start command: `pnpm --filter vtt-server start`
- [ ] Node.js version matches local (check in Render settings)

## Success Criteria

Deployment is successful when:

✅ Server shows "Live" on Render
✅ Client shows "Success" on Cloudflare Pages
✅ Production site loads at herobyte.pages.dev
✅ WebSocket connects (wss://)
✅ All core features work
✅ No console errors
✅ Multi-device sync works
✅ Voice chat works between devices
✅ Portraits persist after refresh
✅ No Konva performance warnings

## Notes

- Keep this checklist updated as new features are added
- Add any production-specific issues encountered to the "Common Issues" section
- Review this checklist before every deployment
