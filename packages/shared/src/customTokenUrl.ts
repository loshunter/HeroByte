// What counts as a usable picture for one of a table's own Library tokens.
//
// SHARED, and a sub-module rather than a barrel `export const`, because both
// ends need the same answer: the server refuses anything else, and the client
// has to know that BEFORE it spends two uploads rendering a thumbnail and a
// copy for an address the wire will drop. A refusal is a server-side log —
// nothing reaches the client — so a client that cannot pre-check produces an
// add that looks exactly like a success and leaves nothing behind.

/**
 * A table's OWN upload, at whatever origin the table is served from: the
 * content-addressed tail is what identifies it. It is the one plain-http shape
 * admitted, and only because it is not third-party art at all — POST /assets
 * wrote those bytes, and a table on a LAN or a dev box serves them over http.
 */
const OWN_UPLOAD_URL = /^https?:\/\/[^/\s]+\/assets\/[a-f0-9]{64}$/;

/**
 * An https link, a path on this site (an upload, or the bundled pack), or this
 * table's own upload URL. Anything else — data:, javascript:, other plain
 * http, a protocol-relative `//host` — is refused: the browser's image policy
 * would never draw it, and a link that never renders is a bad entry, not a
 * broken one.
 *
 * @param ownOrigin - when given, the plain-http exemption is narrowed to THIS
 *   origin. Without it the rule reads only the `/assets/<sha256>` tail, so
 *   `http://anything.example/assets/<64 hex>` passes — and on the https
 *   production table the browser blocks that as mixed content and draws
 *   nothing, which is the exact failure the whole rule exists to prevent. The
 *   client knows its own asset origin (`httpBaseFromWsUrl(WS_URL)`) and passes
 *   it; the server does not — behind Render's proxy it has no configured
 *   public origin to compare against — so it stays host-agnostic and the
 *   client is the stricter of the two. That direction is safe: a stricter
 *   client can only refuse an entry the server would have taken, never invent
 *   a success. The origin is deliberately NOT pinned for existing shelf
 *   entries, which are never re-validated: the same table is reachable over
 *   localhost, a LAN address and the deployed host, and a session file carries
 *   whichever one wrote it.
 */
export function isCustomTokenImageUrl(value: string, ownOrigin?: string): boolean {
  if (/^https:\/\/\S+$/.test(value) || /^\/[^/\s]\S*$/.test(value)) return true;
  if (!OWN_UPLOAD_URL.test(value)) return false;
  return ownOrigin === undefined || value.startsWith(`${ownOrigin}/assets/`);
}
