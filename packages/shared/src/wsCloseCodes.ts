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

/** Auth rejected (bad room password / invalid room). Terminal — no reconnect. */
export const WS_CLOSE_AUTH_REJECTED = 4001;

/**
 * This uid opened a newer connection (another tab/window/device took over the
 * session). Terminal for the OLD socket — it must NOT reconnect, or the two
 * contexts thrash each other forever, each superseding the other.
 */
export const WS_CLOSE_REPLACED = 4002;
