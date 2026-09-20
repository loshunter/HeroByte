# HeroByte Security Requirements

This document tracks the concrete requirements we want to satisfy as we add authentication and access controls to HeroByte. It prioritizes short-term goals for the upcoming room password flow and outlines medium-term needs so we can design with future expansion in mind.

## 1. Room Access Control

- **Room Secret**: Every hosted room MUST be protected by a shared secret (password or invite token). The server SHALL reject WebSocket connections that do not present the correct secret.
- **Secret Lifecycle**: Secrets SHOULD be set by the room creator at room creation time and MAY be changed by a DM during a session. When changed, existing clients MUST re-authenticate before regaining write access.
- **Transport Handling**: Secrets MUST NOT be logged or echoed back to clients. They SHALL be transmitted over WebSocket only during the initial authentication handshake and stored in memory on the server.

## 2. Player Identity & Sessions

- **Session Binding**: Each client connection MUST bind a user identity (`uid`) to its authenticated room secret. The server SHALL treat `uid` values that fail authentication as untrusted and disconnect them. **Satisfied (2026-09):** a successful `authenticate` mints a per-session token (`auth-ok.sessionToken`, 256-bit, only its SHA-256 held server-side, never on disk or in a URL); the uid's live session belongs to the one socket that proved it. A second socket claiming a live uid is held, its messages dropped, and it is closed with `WS_CLOSE_SESSION_CONFLICT` (4003) unless it presents that token — the room password alone is shared by the whole table and does not identify a member.
- **Reconnection**: Reconnecting clients MAY reuse the same `uid` if they present the correct secret. Failed attempts MUST count toward rate limiting. **Satisfied, with one refinement:** the persisted DM flag is restored only when the reconnect also presents the session token (`authenticate.token`); a password-only reclaim gets the uid's record as a non-DM and re-elevates with the DM password. Tokens survive a disconnect for a 6-hour grace window so a reload or a network blip resumes as the same session, then expire.
- **Persistence**: Secrets SHALL NOT be persisted in plain text in snapshots or disk saves. Room snapshots MUST NOT leak secrets.

## 3. DM & Role Authorization

- **DM Privileges**: Actions that change global state (e.g., toggling DM mode for other players, loading sessions) MUST be restricted to authenticated DMs.
- **Role Assignment**: The server SHALL validate any request that escalates privileges (e.g., claiming DM) against the authenticated roles for that connection.
- **Revocation**: If a DM revokes another player's access, the server MUST disconnect that player and invalidate their session.

## 4. Messaging & Rate Limits

- **Authenticated Envelope**: Every client message MUST be associated with an authenticated session. Messages from unauthenticated or expired sessions SHALL be dropped before routing.
- **Brute Force Protections**: The rate limiter MUST cover authentication attempts in addition to gameplay messages to prevent password brute forcing.

## 5. Observability & UX

- **User Feedback**: The client MUST surface connection/authentication failures with actionable messaging (e.g., "Room password incorrect").
- **Server Monitoring**: Authentication failures SHOULD be logged (without secrets) so we can monitor abuse attempts.

## 6. Future-Proofing

- **Token Upgrade Path**: The design SHOULD allow replacing shared secrets with per-user signed tokens later (e.g., Authlocal or custom JWT). Avoid coupling logic tightly to plain-text passwords.
- **Private Rooms**: The room system SHOULD support multiple concurrent rooms with isolated secrets and state.

These requirements will guide the upcoming implementation of the room password flow and ensure that subsequent features (invite links, sovereign identities) can layer on without re-architecting the core handshake.
