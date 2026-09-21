// ============================================================================
// WebSocket close codes (application-defined, 4000-4999 range)
// ============================================================================
// The server closes a socket with one of these; the client branches on the
// code to decide whether reconnecting makes sense. Distinct codes matter: an
// intentional close (auth rejected, superseded by another tab) must NOT trigger
// the auto-reconnect loop, while a transient network drop must.
//
// DEFENCE IN DEPTH ONLY — never the sole signal. Render's proxy rewrites every
// server-sent close code to 1005 ("no status received"; found live 2026-09-20,
// in a real browser), so in production the client sees NONE of these. What it
// does see is a data frame: for the two reasons below, the server announces
// the close with a `connection-closing` message before the close frame, much
// as `auth-failed` precedes WS_CLOSE_AUTH_REJECTED — which is why that code
// was never a casualty. The codes still arrive on a direct connection (local
// dev, e2e) and are kept for that. Other intentional closes of a live socket
// (the heartbeat-timeout 4000, the policy-violation 1008 at connect) send no
// frame: through the proxy they read as a transient drop and the client
// reconnects, which is the right outcome for both.
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

/**
 * Why the server is about to close this socket on purpose, carried in the
 * `{ t: "connection-closing", reason }` data frame that precedes the close.
 * The client goes terminal on the FRAME; the close code that follows is the
 * fallback for connections no proxy rewrites.
 *
 * - "replaced": WS_CLOSE_REPLACED — a newer connection took over this uid.
 *   Terminal: reconnecting would take the seat back and the two contexts
 *   would war forever (the production bug this frame exists to end: two tabs
 *   of one browser thrashing every 2 s, because the code never arrived).
 * - "conflict": WS_CLOSE_SESSION_CONFLICT — sent to a NEWCOMER that could
 *   not prove the session. Not auto-retried; the user retries by hand.
 *
 * Mixed versions: a tab still running a build older than this frame ignores
 * it (the router's unknown-type floor) and keeps the old code-driven
 * behaviour until it reloads. A client that knows the frame ends the session
 * on ANY reason — one it does not recognise is held as a conflict, never
 * reconnected — so adding a reason here can never restart the war.
 */
export type ConnectionClosingReason = "replaced" | "conflict";
