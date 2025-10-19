# HeroByte Quick Reference

## Default Credentials (Development)

| Password Type | Default Value | How to Change |
|--------------|---------------|---------------|
| **Room Password** | `Fun1` | DM Menu → Session → Room Security |
| **DM Password** | `FunDM` | Player Settings → Make myself DM (first time) |

## Quick Actions

### Become DM
1. Click **gear icon** on your player card
2. Click **"Make myself DM"**
3. Enter DM password: `FunDM`
4. ✅ You're now the Dungeon Master!

### Set Private Room Password
1. Become DM (see above)
2. Open **DM Menu** (bottom-right corner)
3. Go to **Session** tab
4. Under "Room Security", enter new password
5. Confirm password
6. Click **"Update Password"**
7. Share new password with your players

### Save Your Session
1. Open **DM Menu** → **Session** tab
2. Enter a session name (optional)
3. Click **"Save Game State"**
4. Download saves as JSON file
5. Store somewhere safe

### Load a Session
1. Open **DM Menu** → **Session** tab
2. Click **"Load Game State"**
3. Select your saved JSON file
4. Session restores with all maps, tokens, and drawings

### Reset to Demo Defaults (Manual)
```bash
# Stop the server (Ctrl+C)
rm apps/server/herobyte-state.json
rm apps/server/herobyte-room-secret.json
pnpm dev
```

## Common Shortcuts

| Action | Shortcut |
|--------|----------|
| Undo Drawing | `Ctrl+Z` / `Cmd+Z` |
| Redo Drawing | `Ctrl+Shift+Z` / `Cmd+Shift+Z` |
| Delete Selected | `Delete` / `Backspace` |
| Cancel Tool | `Esc` |
| Pan Map | Hold `Space` + Drag |
| Zoom | Mouse Wheel |

## Environment Variables

Create `.env` file in project root:

```bash
# Room access password
HEROBYTE_ROOM_SECRET="Fun1"

# DM elevation password
HEROBYTE_DM_PASSWORD="FunDM"

# CORS whitelist (comma-separated)
HEROBYTE_ALLOWED_ORIGINS="http://localhost:5173,https://yourdomain.com"

# Default room ID (future multi-room support)
HEROBYTE_DEFAULT_ROOM_ID="default"
```

## Typical Game Session

### Before Your Game
1. ✅ Become DM (`FunDM`)
2. ✅ Set private room password
3. ✅ Share password with players
4. ✅ Load map background (DM Menu → Map Setup)

### During Your Game
1. 🎲 Use tools to draw, measure, place tokens
2. 💬 Use voice chat to communicate
3. 🎯 Roll dice via dice panel
4. 💾 Save periodically (DM Menu → Session)

### After Your Game
1. 💾 Save final state
2. 🔄 Reset room password to `Fun1` (optional)
3. 🧹 Clear drawings/tokens (optional)
4. 👋 Disconnect

## Troubleshooting

### Can't Join Room
- Verify room password (case-sensitive)
- Try `Fun1` if using default
- Clear browser cache
- Check server is running (`http://localhost:8787`)

### Can't Become DM
- Use password `FunDM` (not `Fun1`)
- Check for typos (case-sensitive)
- Verify server logs for errors

### Port Already in Use
```bash
./kill-ports.sh  # Clean up stuck processes
```

### Start Fresh
```bash
rm apps/server/*.json  # Delete all state
pnpm dev              # Restart server
```

## File Locations

| File | Purpose |
|------|---------|
| `apps/server/herobyte-room-secret.json` | Hashed passwords (room + DM) |
| `apps/server/herobyte-state.json` | Game session state |
| `apps/client/dist/` | Built client assets |
| `apps/server/dist/` | Built server code |

## URLs

| Service | URL |
|---------|-----|
| Client | http://localhost:5173 |
| Server | http://localhost:8787 |
| Network Access | http://YOUR_IP:5173 |

## Documentation

| Topic | File |
|-------|------|
| Demo Workflow | [docs/DEMO_SERVER_WORKFLOW.md](docs/DEMO_SERVER_WORKFLOW.md) |
| Auth System | [ROOM_AUTH_FLOW.md](ROOM_AUTH_FLOW.md) |
| Development | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Testing | [TESTING_SETUP.md](TESTING_SETUP.md) |
| Deployment | [CLOUDFLARE_PAGES_DEPLOYMENT.md](CLOUDFLARE_PAGES_DEPLOYMENT.md) |

## Need Help?

- 📚 Full guides in `/docs` folder
- 🐛 Report issues on GitHub
- 💬 Check server console for errors
- 🔍 Search `README.md` for detailed info
