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

## Future Enhancements

- Replace shared secret with per-room secrets stored with room metadata.
- Issue short-lived signed tokens after password entry to avoid resending secrets.
- Integrate invite links (`wss://.../connect?roomId=abc&token=...`).
- Layer in Authlocal or other identity systems once room boundaries are solid.

This design keeps the immediate change manageable while isolating auth logic so we can iterate toward more robust identity in later phases.
