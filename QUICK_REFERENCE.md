# HeroByte Quick Reference

## Default Credentials (Development)

| Password Type      | Default Value | Notes                                                                           |
| ------------------ | ------------- | ------------------------------------------------------------------------------- |
| **Table Password** | `Fun1`        | Fixed on the Main Hall. Private tables set their own (Session → Table Security) |
| **DM Password**    | `FunDM`       | Fixed on the Main Hall. Private tables set their own at creation                |

> The Main Hall is the **public test table**: both passwords are fixed so it always stays open, and
> it is wiped after an hour empty. To keep work from it, use DM Menu → Session →
> **Save as a Private Table**.

## Quick Actions

### Become DM

1. Click the **⚙️ gear icon** on your player card
2. Under "Dungeon Master Mode", click **"DM Mode: OFF"**
3. Enter DM password: `FunDM`
4. ✅ You're now the Dungeon Master!

> On a table created without a DM password, this prompt offers to set one — you
> become DM as soon as it's saved. See the
> [Getting Started guide](docs/user-guide/getting-started.md#becoming-the-dm).

### Set a Private Table's Password

(The Main Hall's password is fixed — this applies to private tables.)

1. Become DM (see above)
2. Open **DM Menu** (bottom-right corner)
3. Go to **Session** tab
4. Under "Table Security", enter new password
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

```powershell
# Stop the server (Ctrl+C)
Remove-Item -LiteralPath apps/server/herobyte-state.json, apps/server/herobyte-room-secret.json -ErrorAction SilentlyContinue
pnpm dev
```

## Common Shortcuts

| Action          | Shortcut                               |
| --------------- | -------------------------------------- |
| Undo Drawing    | `Ctrl+Z` / `Cmd+Z`                     |
| Redo Drawing    | `Ctrl+Shift+Z` / `Cmd+Shift+Z`         |
| Delete Selected | `Delete` / `Backspace`                 |
| Cancel Tool     | `Esc`                                  |
| Pan Map         | Drag empty space, or middle-mouse drag |
| Zoom            | Mouse Wheel                            |

## Environment Variables

Create `.env` file in project root:

```bash
# Room access password
HEROBYTE_ROOM_SECRET="Fun1"

# DM elevation password
HEROBYTE_DM_PASSWORD="FunDM"

# CORS whitelist (comma-separated)
HEROBYTE_ALLOWED_ORIGINS="http://localhost:5174,https://yourdomain.com"

# Room ID of the default table (Main Hall)
HEROBYTE_DEFAULT_ROOM_ID="default"
```

## Typical Game Session

### Before Your Game

1. ✅ Become DM (`FunDM`)
2. ✅ Set private table password
3. ✅ Share password with players
4. ✅ Load map background (DM Menu → Map Setup)

### During Your Game

1. 🎲 Use tools to draw, measure, place tokens
2. 💬 Use voice chat to communicate
3. 🎯 Roll dice via dice panel
4. 💾 Save periodically (DM Menu → Session)

### After Your Game

1. 💾 Save final state
2. 🔄 On a private table, reset its password (DM Menu → Session → Table Security → "Reset to Default") (optional)
3. 🧹 Clear drawings/tokens (optional)
4. 👋 Disconnect

## Troubleshooting

### Can't Join a Table

- Verify the table password (case-sensitive)
- Try `Fun1` if using default
- Clear browser cache
- Check server is running (`http://localhost:8787`)

### Can't Become DM

- Use password `FunDM` (not `Fun1`)
- Check for typos (case-sensitive)
- Verify server logs for errors

### Port Already in Use

```bash
pnpm dev:doctor  # Show what owns the dev ports
pnpm dev:free    # Safely stop stale HeroByte dev processes
```

### Start Fresh

```powershell
Remove-Item -Path apps/server/*.json -ErrorAction SilentlyContinue
pnpm dev
```

## File Locations

| File                                    | Purpose                      |
| --------------------------------------- | ---------------------------- |
| `apps/server/herobyte-room-secret.json` | Hashed passwords (room + DM) |
| `apps/server/herobyte-state.json`       | Game session state           |
| `apps/client/dist/`                     | Built client assets          |
| `apps/server/dist/`                     | Built server code            |

## URLs

| Service        | URL                   |
| -------------- | --------------------- |
| Client         | http://localhost:5174 |
| Server         | http://localhost:8787 |
| Network Access | http://YOUR_IP:5174   |

For LAN play, add the matching origin to `HEROBYTE_ALLOWED_ORIGINS`, for example `http://YOUR_IP:5174`.

## Documentation

| Topic               | File                                                         |
| ------------------- | ------------------------------------------------------------ |
| **All docs**        | [docs/README.md](docs/README.md)                             |
| **Playing & DMing** | [docs/user-guide/](docs/user-guide/README.md)                |
| Demo Workflow       | [docs/DEMO_SERVER_WORKFLOW.md](docs/DEMO_SERVER_WORKFLOW.md) |
| Playtest Setup      | [docs/playtest-setup-guide.md](docs/playtest-setup-guide.md) |
| Auth System         | [ROOM_AUTH_FLOW.md](ROOM_AUTH_FLOW.md)                       |
| Development         | [DEVELOPMENT.md](DEVELOPMENT.md)                             |
| Testing             | [docs/TESTING.md](docs/TESTING.md)                           |
| Deployment          | [DEPLOYMENT.md](DEPLOYMENT.md)                               |

## Need Help?

- 📚 Full documentation index: [docs/README.md](docs/README.md)
- 🐛 Report issues on GitHub
- 💬 Check server console for errors
- 🔍 Search `README.md` for detailed info
