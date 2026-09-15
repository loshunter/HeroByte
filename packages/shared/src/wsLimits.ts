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

/**
 * The MINT ceiling. A mint — a kicked-in door, an Atlas generate, a new map,
 * an import, the live GENERATE tool — is refused when the session export it
 * would produce weighs more than this on the wire (`loadSessionFrameBytes`).
 * The promise it keeps is the one MAX_SESSION_DOCUMENTS was written for and
 * cannot: a DM's own export always loads back. A count cap only holds while
 * the average document is small, and a `large` generated building is
 * 60–220 KB stored by kind (a warehouse is the heavy one) plus 30–145 KB of
 * compiled scene once the party stands on it.
 *
 * Three quarters of the wire limit, so a quarter is left for play — tokens,
 * drawings, suspended scenes — which no mint gate can see. The count cap
 * stays beside it; a mint clears both or neither. One dial, measured on a
 * fresh table (2026-09-14): two large warehouses, six large taverns, eight or
 * nine large shops or houses; medium maps about twice as many.
 */
export const SESSION_MINT_CEILING_BYTES = Math.floor((WS_MAX_MESSAGE_BYTES * 3) / 4);
