// ============================================================================
// WebSocket close codes (application-defined, 4000-4999 range)
// ============================================================================
// The server closes a socket with one of these; the client branches on the
// code to decide whether reconnecting makes sense. Distinct codes matter: an
// intentional close (auth rejected, superseded by another tab) must NOT trigger
// the auto-reconnect loop, while a transient network drop must.
//
// These live in their own module (not inline in index.ts) on purpose: the
// server's tsconfig maps `@herobyte/shared` to dist/index.d.ts, and tsx honors
// that at runtime. A direct `export declare const` in the barrel's .d.ts is
// erased as an ambient type, but a value RE-EXPORT from a real sub-module is
// followed through to this compiled .js. So constants the server imports must
// live in a sub-module and be re-exported from index.

/**
 * Auth rejected (bad room password / invalid room). NOT terminal: the client
 * reconnects so the user can retry — the auth gate clears the rejected secret on
 * failure, so the reopened socket sits idle awaiting a fresh password rather than
 * re-sending the bad one (no loop). Contrast WS_CLOSE_REPLACED, which IS terminal.
 */
export const WS_CLOSE_AUTH_REJECTED = 4001;

/**
 * This uid opened a newer connection (another tab/window/device took over the
 * session). Terminal for the OLD socket — it must NOT reconnect, or the two
 * contexts thrash each other forever, each superseding the other.
 */
export const WS_CLOSE_REPLACED = 4002;

/**
 * A second connection claimed a uid that is already held — a socket live on
 * another connection (authenticated or not), or a session still provable by a
 * token inside its grace window — and could not prove that session's own
 * token, so it did NOT take over and the holder was left untouched. Sent to
 * the NEWCOMER. Not terminal the way WS_CLOSE_REPLACED is (the user may close
 * the other window and try again), but the client must not auto-retry it
 * either: retrying as the same uid in a loop is the connection war this code
 * exists to avoid.
 */
export const WS_CLOSE_SESSION_CONFLICT = 4003;
