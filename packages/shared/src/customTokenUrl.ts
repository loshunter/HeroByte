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
 */
export function isCustomTokenImageUrl(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) || /^\/[^/\s]\S*$/.test(value) || OWN_UPLOAD_URL.test(value);
}
