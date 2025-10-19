# Room Password Flow Design

This document sketches the minimal changes needed to introduce a shared room password into HeroByte while keeping the door open for richer auth later.

## Goals

- Require a password before a client can participate in the shared room state.
- Keep the server authoritative: only authenticated sessions can mutate or read room data.
- Avoid persisting the password in snapshots or logs.
- Support future evolution to per-room IDs and per-user tokens.

## High-Level Handshake

1. **Client boot**
   - Prompt user for the room password (modal). Persist in `sessionStorage` for the tab.
   - Create WebSocket connection as today, but hold gameplay actions until auth completes.

2. **Authentication message**
   - After `ws.open`, client sends `{ t: "authenticate", secret: <password>, roomId?: "default" }`.
   - Client queues gameplay messages until the server confirms auth.

3. **Server validation**
   - Server looks up expected secret for the requested room (initial MVP: single configured secret from env).
   - If secret matches, mark the `uid` as authenticated and send `{ t: "auth-ok" }`.
   - If secret fails, increment failure counter, send `{ t: "auth-failed" }`, and close the socket after a short delay.

4. **Post-auth**
   - Once authenticated, server allows normal routing; non-auth messages from unauthenticated UIDs are ignored.
   - Regular heartbeat continues; if disconnected, client retries with stored secret.

## Data Structures & Config

- **Server**
  - Add `AuthenticatedSession` map (`uid -> { roomId, authedAt }`).
  - Load expected secret from `process.env.HEROBYTE_ROOM_SECRET` (MVP default fallback for dev).
  - When persisting room state, exclude secret.

- **Client**
  - Extend `useWebSocket` to accept an `onAuthenticated` callback and to queue outbound messages until auth success.
  - Store auth status in hook state so UI can gate access or show loading.

## Message Contract Changes

Update `packages/shared/src/index.ts` to include:

```ts
| { t: "authenticate"; secret: string; roomId?: string }
| { t: "auth-ok" }
| { t: "auth-failed"; reason?: string }
```

Server will reply with `auth-ok` or `auth-failed` before broadcasting the first snapshot. Snapshots are only pushed to authenticated sockets.

## Server Flow Adjustments

- `ConnectionHandler.handleConnection`
  - Mark new connections as unauthenticated and skip `createPlayer`/`createToken` until auth passes.
  - Do not broadcast room state to them yet.

- `handleMessage`
  - If message type is `authenticate`, run secret check.
  - If `uid` is not authenticated and message type is anything else, drop it.

- `MessageRouter.broadcast`
  - Filter out unauthenticated clients to avoid leaking room state.

## Client Flow Adjustments

- `useWebSocket`
  - Add `authenticate(secret)` helper that sends the auth message and resolves when `auth-ok` arrives.
  - Buffer outbound messages while `authPending` is true.

- `App.tsx`
  - On mount, prompt for password (Modal or simple prompt for MVP).
  - Call `authenticate` before enabling UI features. Show error toast if `auth-failed`.

## Error Handling & UX

- On `auth-failed`, client clears stored secret and re-prompts.
- Server logs failed attempts with the `uid` and source IP (if available) but never logs the secret value.
- After N failures (configurable, e.g., 5), server adds a temporary penalty delay before allowing the same IP/uid to retry.

## ✅ Implemented: Dual-Password System (v0.9.0-beta.2)

The room password flow described above has been implemented and enhanced with a **dual-password system** that separates player access from DM privileges:

### Architecture

**Two-Tier Authentication:**
1. **Room Password** (Player Access) - Gets you into the room as a Player
   - Stored in `herobyte-room-secret.json` (hashed with scrypt)
   - Can be set via `HEROBYTE_ROOM_SECRET` env var or updated by DM
   - Length: 6-128 characters

2. **DM Password** (DM Elevation) - Elevates you to DM with special powers
   - Stored separately in same JSON file (dmHash, dmSalt fields)
   - Set by first authenticated user (bootstrap) or updated by current DM
   - Length: 8-128 characters (stricter than room password)

### Bootstrap Flow

1. First user connects with room password → becomes Player
2. First user sets DM password → auto-promoted to DM
3. Subsequent users connect with room password → become Players
4. Players can elevate to DM by providing DM password

### Message Types Added

**Client → Server:**
```ts
| { t: "elevate-to-dm"; dmPassword: string }     // Request DM elevation
| { t: "set-dm-password"; dmPassword: string }   // Set/update DM password (DM-only)
```

**Server → Client:**
```ts
| { t: "dm-status"; isDM: boolean }                      // DM elevation status
| { t: "dm-elevation-failed"; reason?: string }          // Elevation failed
| { t: "dm-password-updated"; updatedAt: number }        // Password set successfully
| { t: "dm-password-update-failed"; reason?: string }    // Update failed
```

### DM-Only Actions

The following actions now require `isDM=true`:
- `create-character` - Create PC slots
- `create-npc`, `update-npc`, `delete-npc` - NPC management
- `place-npc-token` - Place NPC tokens on map
- `clear-drawings` - Clear all players' drawings
- `clear-all-tokens` - Remove all tokens/players
- `load-session` - Load saved session state

### Security Hardening

**Password Hashing:**
- Scrypt with 16-byte salt, 64-byte derived key
- Timing-safe comparison (prevents timing attacks)
- Passwords never stored in plain text

**Input Validation:**
- 1MB message size limit (prevents DoS)
- Password length constraints enforced
- 256 character max on password fields
- Rate limiting on authentication attempts

**XSS Protection:**
- DOMPurify installed for client-side sanitization
- Utility functions in `apps/client/src/utils/sanitize.ts`:
  - `sanitizeText()` - Player names, text fields
  - `sanitizeUrl()` - Blocks javascript:/data:/vbscript:
  - `sanitizeImageDataUri()` - Validates Base64 images
  - `sanitizeHtml()` - Strips HTML tags

### Implementation Files

**Server:**
- `apps/server/src/domains/auth/service.ts` - AuthService with DM password support
- `apps/server/src/ws/connectionHandler.ts` - DM elevation handlers
- `apps/server/src/ws/messageRouter.ts` - DM permission middleware
- `apps/server/src/middleware/validation.ts` - Message size limits
- `herobyte-room-secret.json` - Persisted password storage

**Client:**
- `apps/client/src/ui/App.tsx` - AuthGate component (room password UI)
- `apps/client/src/utils/sanitize.ts` - XSS protection utilities

**Shared:**
- `packages/shared/src/index.ts` - DM message type definitions

### Testing

✅ 235/235 tests passing including:
- 11 DM password tests (authService.test.ts)
- DM permission enforcement tests (messageRouter.test.ts)
- Whitespace trimming, length validation, timing-safe comparison
- Separate persistence of room vs DM passwords

## Future Enhancements

- Replace shared secret with per-room secrets stored with room metadata.
- Issue short-lived signed tokens after password entry to avoid resending secrets.
- Integrate invite links (`wss://.../connect?roomId=abc&token=...`).
- Layer in Authlocal or other identity systems once room boundaries are solid.
- Add structured audit logging for auth and DM actions (winston/pino)
- HTTPS/WSS production deployment guide
- E2E tests for dual-password flow
- DM elevation UI (optional - currently CLI/WebSocket only)

This design keeps the immediate change manageable while isolating auth logic so we can iterate toward more robust identity in later phases.
