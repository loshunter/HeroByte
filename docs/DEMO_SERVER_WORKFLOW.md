# Demo Server Workflow Guide

## Overview

HeroByte's demo server is designed for **casual, drop-in sessions** where you can quickly set up a private game, play, and then clean up afterward. This guide explains how to manage passwords and session state for a typical game session.

## Default Credentials (Development)

The demo server comes with permissive defaults for easy testing:

- **Room Password**: `Fun1`
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
   - Open your player settings (gear icon on your player card)
   - Click "Make myself DM"
   - Enter DM password: `FunDM` (or your custom password)

2. **Set a Private Room Password** (Optional but recommended)
   - Open DM Menu (bottom-right corner)
   - Go to **Session** tab
   - Under "Room Security", enter a private password (e.g., `MyPrivateGame123`)
   - Confirm the password
   - Click "Update Password"

3. **Share the New Password with Your Players**
   - Send the new room password to your trusted players via Discord/Slack/etc.
   - This prevents random users from joining your game

### 2. During the Game

- **Manage your session** as normal (maps, tokens, drawings, NPCs)
- **Save Important Sessions**: Use DM Menu → Session → "Save Game State" before major milestones
- Your private room password keeps random users out
- Only players with the password can join

### 3. Post-Game Cleanup

**When your session is done:**

1. **Save Your Session** (if you want to continue later)
   - DM Menu → Session → "Save Game State"
   - Download saves as a JSON file
   - Store it somewhere safe (Google Drive, Dropbox, etc.)

2. **Reset to Demo Defaults** *(Feature coming soon!)*
   - DM Menu → Session → "Reset to Demo Mode"
   - This will:
     - Reset room password to `Fun1`
     - Reset DM password to `FunDM`
     - Clear all drawings, tokens, and NPCs (optional)
     - Restore default spawn positions
   - Leaves the server in a clean state for the next demo user

### Manual Cleanup (Current Method)

Until the "Reset to Demo Mode" button is implemented, you can manually clean up:

1. **Reset Room Password**
   - DM Menu → Session → Room Security
   - Set password back to: `Fun1`

2. **Clear Session State** (optional)
   - DM Menu → Map Setup → "Clear All Drawings"
   - Manually delete NPCs from the NPCs & Monsters tab
   - Ask players to disconnect

3. **Server Restart** (nuclear option)
   - If you're running the server locally, restart it
   - This clears all in-memory state
   - State persists in `herobyte-state.json` and `herobyte-room-secret.json`

## File Locations (For Manual Management)

If you need to manually reset server state:

```bash
# From project root
rm apps/server/herobyte-state.json        # Clears game state
rm apps/server/herobyte-room-secret.json  # Resets passwords to defaults
```

After deleting these files, restart the server:

```bash
pnpm dev
```

The server will recreate these files with default values.

## Security Considerations

### For Demo/Development

- Default passwords are **intentionally simple** for quick testing
- Anyone with access to the server URL can join (if they know the room password)
- DM password prevents random users from gaining admin privileges
- **Do not use default passwords in production**

### For Private Games

1. **Always change the room password** before your session
2. **Use a strong DM password** (8+ characters, mix of letters/numbers)
3. **Share passwords securely** (private chat, not public channels)
4. **Reset to defaults** after your session to prevent password leaks

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

| Variable | Default | Purpose |
|----------|---------|---------|
| `HEROBYTE_ROOM_SECRET` | `Fun1` | Room entry password (6-128 chars) |
| `HEROBYTE_DM_PASSWORD` | `FunDM` | DM elevation password (8-128 chars) |
| `HEROBYTE_ALLOWED_ORIGINS` | `localhost:5173` | CORS whitelist (comma-separated) |
| `HEROBYTE_DEFAULT_ROOM_ID` | `default` | Room identifier (future multi-room support) |

## Troubleshooting

### "Invalid room password" when trying to join

- Verify you're using the correct password (case-sensitive)
- Check if the DM changed it during the session
- Try clearing browser cache/sessionStorage

### Can't become DM

- Ensure you're using the correct DM password (`FunDM` by default)
- Check server logs for authentication errors
- Verify `herobyte-room-secret.json` exists and has DM password fields

### Want to start completely fresh

```bash
# Stop the server (Ctrl+C)
rm apps/server/herobyte-state.json
rm apps/server/herobyte-room-secret.json
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
3. UI button in DM Menu → Session tab
4. Confirmation dialog to prevent accidental resets
