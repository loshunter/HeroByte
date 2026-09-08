// ============================================================================
// WebSocket wire limits
// ============================================================================
// The size of one message, agreed by both ends. The server sets it twice — as
// `maxPayload` on the WebSocketServer (socket level, checked against the
// DECLARED frame length before a byte is buffered) and as the pipeline's
// `maxMessageSize` (application level, after buffering) — and the client needs
// it to tell a DM that a session file is too large BEFORE sending a frame that
// will be dropped with a 1009 close nobody surfaces.
//
// It lives in its own module, not inline in index.ts, for the reason
// wsCloseCodes.ts spells out: the server's tsconfig maps `@herobyte/shared` to
// dist/index.d.ts, and a direct `export declare const` in the barrel's .d.ts is
// erased as an ambient type. A value RE-EXPORT from a real sub-module is
// followed through to this compiled .js. Constants the server imports at
// RUNTIME must live here and be re-exported from the barrel.

/**
 * Bytes in one WebSocket message, either direction. ws defaults to 100 MiB,
 * which would let a client make the server buffer that much before any guard
 * saw it; 1 MiB comfortably clears the largest legitimate frame (a session
 * file, a full snapshot) while keeping that window small.
 */
export const WS_MAX_MESSAGE_BYTES = 1024 * 1024;
