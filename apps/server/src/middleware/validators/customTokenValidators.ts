// ============================================================================
// CUSTOM TOKEN VALIDATION
// ============================================================================
// Validates the two messages behind a table's own Library tokens.

import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";
import { isTokenSize } from "./commonValidators.js";

const { NAME_MAX, DESCRIPTION_MAX, TAG_MAX, TAGS_MAX, URL_MAX } = CUSTOM_TOKEN_LIMITS;
const fail = (error: string): ValidationResult => ({ valid: false, error });

/**
 * A table's OWN upload, at whatever origin this table is served from: the
 * content-addressed tail is what identifies it, exactly as the client's
 * `uploadHashFromUrl` reads a hash back out without pinning an origin. It is
 * the one plain-http shape admitted, and only because it is not third-party
 * art at all — POST /assets wrote those bytes, and a table on a LAN or a dev
 * box serves them over http. Without this, ⬆ UPLOAD on the shelf's form built
 * a URL its own validator refused, and the add vanished with no word to the
 * DM on every table not behind TLS.
 */
const OWN_UPLOAD_URL = /^https?:\/\/[^/\s]+\/assets\/[a-f0-9]{64}$/;

/**
 * An https link, a path on this site (an upload, or the bundled pack), or
 * this table's own upload URL. Anything else — data:, javascript:, other
 * plain http, a protocol-relative `//host` — is refused: the browser's image
 * policy would never draw it, and a link that never renders is a bad entry,
 * not a broken one.
 */
export function isCustomTokenImageUrl(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) || /^\/[^/\s]\S*$/.test(value) || OWN_UPLOAD_URL.test(value);
}

export function validateAddCustomTokenMessage(message: MessageRecord): ValidationResult {
  const { name, imageUrl, description, tags, size } = message;
  if (typeof name !== "string" || name.trim().length === 0 || name.length > NAME_MAX) {
    return fail(`add-custom-token: name must be 1-${NAME_MAX} characters`);
  }
  if (typeof imageUrl !== "string" || imageUrl.length === 0 || imageUrl.length > URL_MAX) {
    return fail(`add-custom-token: imageUrl must be 1-${URL_MAX} characters`);
  }
  if (!isCustomTokenImageUrl(imageUrl)) {
    return fail("add-custom-token: imageUrl must be an https link or a path on this site");
  }
  if (
    description !== undefined &&
    (typeof description !== "string" || description.length > DESCRIPTION_MAX)
  ) {
    return fail(`add-custom-token: description must be at most ${DESCRIPTION_MAX} characters`);
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > TAGS_MAX) {
      return fail(`add-custom-token: tags must be a list of at most ${TAGS_MAX}`);
    }
    for (const tag of tags) {
      if (typeof tag !== "string" || tag.trim().length === 0 || tag.length > TAG_MAX) {
        return fail(`add-custom-token: each tag must be 1-${TAG_MAX} characters`);
      }
    }
  }
  if (size !== undefined && !isTokenSize(size)) {
    return fail("add-custom-token: size must be a token size");
  }
  return { valid: true };
}

export function validateRemoveCustomTokenMessage(message: MessageRecord): ValidationResult {
  return typeof message.id === "string" && message.id.length > 0
    ? { valid: true }
    : fail("remove-custom-token: id must be a non-empty string");
}
