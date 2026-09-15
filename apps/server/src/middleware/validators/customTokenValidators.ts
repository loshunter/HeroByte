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
 * An https link, or a path on this site (an upload, or the bundled pack).
 * Anything else — data:, javascript:, plain http, a protocol-relative
 * `//host` — is refused: the browser's image policy would never draw it, and
 * a link that never renders is a bad entry, not a broken one.
 */
export function isCustomTokenImageUrl(value: string): boolean {
  return /^https:\/\/\S+$/.test(value) || /^\/[^/\s]\S*$/.test(value);
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
