# Demo Server Workflow Guide

## Overview

HeroByte's demo server is designed for **casual, drop-in sessions** where you can quickly set up a private game, play, and then clean up afterward. This guide explains how to manage passwords and session state for a typical game session.

## Default Credentials (Development)

The demo server comes with permissive defaults for easy testing:

- **Table password**: `Fun1` (published in this repository: a table that still uses it is open to anyone who has its code)
- **DM Password**: `FunDM`

⚠️ **Production Note**: These defaults are for development only. For production deployments, set secure passwords via environment variables:

```bash
HEROBYTE_ROOM_SECRET="your-secure-room-password"
HEROBYTE_DM_PASSWORD="your-secure-dm-password"
```

## Typical Game Session Workflow

### 1. Pre-Game Setup

**Before your players join:**

1. **Become DM**
   - Open the Table button at the left of the header (on a phone: Tools → Table)
   - Click "Enter DM mode"
   - Enter DM password: `FunDM` (or your custom password)

2. **Make It Private** (Optional but recommended)
   - The public test table's password is fixed (the server's configured default: `Fun1` unless `HEROBYTE_ROOM_SECRET` sets another) so the table stays open for everyone; it cannot be changed there
   - Open DM Menu (bottom-right corner) and go to the **Table** tab
   - Under **Save as a Private Table**, give it a name, a table password (e.g., `MyPrivateGame123`) and a DM password, then press **Save & Go There**
   - Everything on the table is copied to your own private table and you arrive there as a player: choose **Enter DM mode** again, with the DM password you just set

3. **Share the Link and the Password with Your Players**
   - Copy the link from the Table tab's **Invite** section and send it to your trusted players via Discord/Slack/etc., and send the table password separately (the link never carries it)
   - This prevents random users from joining your game

### 2. During the Game

- **Manage your session** as normal (maps, tokens, drawings, NPCs)
- **Save Important Sessions**: Use DM Menu → Table → Backups → "Download table backup" before major milestones
- Your private table's password keeps random users out
- Only players with the password can join

### 3. Post-Game Cleanup

**When your session is done:**

1. **Save Your Session** (if you want to continue later)
   - DM Menu → Table → Backups → "Download table backup"
   - Download saves as a JSON file
   - Store it somewhere safe (Google Drive, Dropbox, etc.)

2. **Leave the passwords as they are** (if you will keep using the table)
   - A private table keeps its own table password and DM password between sessions, so the same link and passwords still work next session
   - Do not use "Reset to default" on a table you keep: it gives the table the public Main Hall's password (`Fun1` unless `HEROBYTE_ROOM_SECRET` sets another), which anyone who has the table's code could then join with

### Manual Cleanup

For a fuller cleanup:

1. **Clear Session State** (optional)
   - DM Menu → Maps → "Clear All Drawings"
   - Manually delete NPCs from the NPCs & Monsters tab
   - Ask players to disconnect

2. **Server Restart** (nuclear option)
   - If you're running the server locally, restart it
   - This clears all in-memory state
   - State persists in `herobyte-state.json` and `herobyte-room-secret.json`

## File Locations (For Manual Management)

If you need to manually reset server state:

```powershell
# From project root
Remove-Item -LiteralPath apps/server/herobyte-state.json, apps/server/herobyte-room-secret.json -ErrorAction SilentlyContinue
```

After deleting these files, restart the server:

```bash
pnpm dev
```

The server will recreate these files with default values.

## Security Considerations

### For Demo/Development

- Default passwords are **intentionally simple** for quick testing
- Anyone with access to the server URL can join (if they know the table password)
- DM password prevents random users from gaining admin privileges
- **Do not use default passwords in production**

### For Private Games

1. **Always play on a private table** with its own table password (Table → Save as a Private Table) before your session
2. **Use a strong DM password** (8+ characters, mix of letters/numbers)
3. **Share passwords securely** (private chat, not public channels)
4. **Change the table password if it may have leaked** (DM Menu → Table → Security → "Change table password"). Never use "Reset to default" on a table you keep: it gives the table the published password (`Fun1` unless `HEROBYTE_ROOM_SECRET` sets another)

### For Production Deployments

1. Set environment variables for strong passwords:

   ```bash
   HEROBYTE_ROOM_SECRET="$(openssl rand -base64 32)"
   HEROBYTE_DM_PASSWORD="$(openssl rand -base64 32)"
   ```

2. Use HTTPS/WSS for all connections

3. Enable CORS restrictions via `HEROBYTE_ALLOWED_ORIGINS`

4. Consider implementing:
   - IP-based rate limiting
   - Account-based authentication (future feature)
   - Session expiration

## Environment Variables Reference

| Variable                   | Default                 | Purpose                                     |
| -------------------------- | ----------------------- | ------------------------------------------- |
| `HEROBYTE_ROOM_SECRET`     | `Fun1`                  | Room entry password (use 6+; not length-checked) |
| `HEROBYTE_DM_PASSWORD`     | `FunDM`                 | DM elevation password (use 8+; not length-checked) |
| `HEROBYTE_ALLOWED_ORIGINS` | `localhost` / `127.0.0.1` on 5174 and 4173, and `https://herobyte.pages.dev` | CORS whitelist (comma-separated); setting it replaces the default list |
| `HEROBYTE_DEFAULT_ROOM_ID` | `default`               | Room identifier (future multi-room support) |

## Troubleshooting

### "Invalid room password" when trying to join

- Verify you're using the correct password (case-sensitive)
- Check if the DM changed it during the session
- Try clearing browser cache/sessionStorage

### Can't become DM

- Ensure you're using the correct DM password (`FunDM` by default)
- Check server logs for authentication errors
- On the default table the DM password is `HEROBYTE_DM_PASSWORD` (else `FunDM`) as set when the server last started; on a private table it is the one its creator set

### Want to start completely fresh

```powershell
# Stop the server (Ctrl+C)
Remove-Item -LiteralPath apps/server/herobyte-state.json, apps/server/herobyte-room-secret.json -ErrorAction SilentlyContinue
pnpm dev
```

This gives you a clean slate with default passwords.

## Future Enhancements

Planned features to improve the demo workflow:

- [ ] **"Reset to Demo Mode" button** in DM Menu (one-click cleanup)
- [ ] **Session Templates** (save/load default configurations)
- [ ] **Guest Mode** (temporary access without changing passwords)
- [ ] **Session Timer** (auto-cleanup after N hours of inactivity)
- [ ] **Password Generation** (built-in secure password generator)
- [ ] **Invite Links** (share a time-limited URL instead of passwords)

## Contributing

If you'd like to help implement the "Reset to Demo Mode" feature, see:

- `apps/server/src/domains/auth/service.ts` - Password management
- `apps/client/src/features/dm/components/DMMenu.tsx` - DM UI
- `packages/shared/src/index.ts` - Message type definitions

The implementation would involve:

1. New client message: `{ t: "reset-to-demo-mode"; clearState: boolean }`
2. Server handler that resets passwords and optionally clears state
3. UI button in DM Menu → Table tab
4. Confirmation dialog to prevent accidental resets
