// ============================================================================
// CUSTOM TOKEN VALIDATION
// ============================================================================
// Validates the two messages behind a table's own Library tokens.

import { CUSTOM_TOKEN_LIMITS, isCustomTokenImageUrl } from "@herobyte/shared";
import type { MessageRecord, ValidationResult } from "./commonValidators.js";
import { isNpcDisposition, isTokenSize } from "./commonValidators.js";

const { NAME_MAX, DESCRIPTION_MAX, TAG_MAX, TAGS_MAX, URL_MAX } = CUSTOM_TOKEN_LIMITS;
const fail = (error: string): ValidationResult => ({ valid: false, error });

// The URL rule lives in @herobyte/shared now: the CLIENT has to apply the
// same test before it spends two uploads on an address the wire will drop,
// and a refusal never reaches the client to tell it otherwise.
export { isCustomTokenImageUrl };

export function validateAddCustomTokenMessage(message: MessageRecord): ValidationResult {
  const { name, imageUrl, thumbUrl, description, tags, size, disposition } = message;
  if (typeof name !== "string" || name.trim().length === 0 || name.length > NAME_MAX) {
    return fail(`add-custom-token: name must be 1-${NAME_MAX} characters`);
  }
  if (typeof imageUrl !== "string" || imageUrl.length === 0 || imageUrl.length > URL_MAX) {
    return fail(`add-custom-token: imageUrl must be 1-${URL_MAX} characters`);
  }
  if (!isCustomTokenImageUrl(imageUrl)) {
    return fail("add-custom-token: imageUrl must be an https link or a path on this site");
  }
  // The thumbnail is a second image the client drew and uploaded, so it meets
  // exactly the bar imageUrl does — it reaches every client's image loader by
  // the same road, and "the client made it" is not a fact the server can know.
  if (thumbUrl !== undefined) {
    if (typeof thumbUrl !== "string" || thumbUrl.length === 0 || thumbUrl.length > URL_MAX) {
      return fail(`add-custom-token: thumbUrl must be 1-${URL_MAX} characters`);
    }
    if (!isCustomTokenImageUrl(thumbUrl)) {
      return fail("add-custom-token: thumbUrl must be an https link or a path on this site");
    }
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
  if (disposition !== undefined && !isNpcDisposition(disposition)) {
    return fail("add-custom-token: disposition must be a stance");
  }
  return { valid: true };
}

export function validateRemoveCustomTokenMessage(message: MessageRecord): ValidationResult {
  return typeof message.id === "string" && message.id.length > 0
    ? { valid: true }
    : fail("remove-custom-token: id must be a non-empty string");
}
