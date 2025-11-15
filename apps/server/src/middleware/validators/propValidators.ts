// ============================================================================
// PROP VALIDATION
// ============================================================================
// Validates prop-related messages: create, update, delete

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { VALID_TOKEN_SIZES } from "./commonValidators.js";
import { STRING_LIMITS } from "./constants.js";

/**
 * Validate create-prop message
 * Required: label (string, 1-50 chars), imageUrl (string), owner (null, "*", or string),
 *           size (valid TokenSize), viewport ({x, y, scale})
 */
export function validateCreatePropMessage(message: MessageRecord): ValidationResult {
  const { label, imageUrl, owner, size, viewport } = message;

  if (
    typeof label !== "string" ||
    label.length === 0 ||
    label.length > STRING_LIMITS.PROP_LABEL_MAX
  ) {
    return { valid: false, error: "create-prop: label must be 1-50 characters" };
  }
  if (typeof imageUrl !== "string") {
    return { valid: false, error: "create-prop: imageUrl must be a string" };
  }
  if (owner !== null && owner !== "*" && typeof owner !== "string") {
    return { valid: false, error: "create-prop: owner must be null, '*', or a player UID" };
  }
  if (
    typeof size !== "string" ||
    !VALID_TOKEN_SIZES.includes(size as (typeof VALID_TOKEN_SIZES)[number])
  ) {
    return { valid: false, error: "create-prop: size must be a valid TokenSize" };
  }
  if (
    !viewport ||
    typeof viewport !== "object" ||
    !("x" in viewport) ||
    !("y" in viewport) ||
    !("scale" in viewport) ||
    typeof viewport.x !== "number" ||
    typeof viewport.y !== "number" ||
    typeof viewport.scale !== "number"
  ) {
    return { valid: false, error: "create-prop: viewport must be {x, y, scale}" };
  }
  return { valid: true };
}

/**
 * Validate update-prop message
 * Required: id (string), label (string, 1-50 chars), imageUrl (string),
 *           owner (null, "*", or string), size (valid TokenSize)
 */
export function validateUpdatePropMessage(message: MessageRecord): ValidationResult {
  const { id, label, imageUrl, owner, size } = message;

  if (typeof id !== "string" || id.length === 0) {
    return { valid: false, error: "update-prop: missing or invalid id" };
  }
  if (
    typeof label !== "string" ||
    label.length === 0 ||
    label.length > STRING_LIMITS.PROP_LABEL_MAX
  ) {
    return { valid: false, error: "update-prop: label must be 1-50 characters" };
  }
  if (typeof imageUrl !== "string") {
    return { valid: false, error: "update-prop: imageUrl must be a string" };
  }
  if (owner !== null && owner !== "*" && typeof owner !== "string") {
    return { valid: false, error: "update-prop: owner must be null, '*', or a player UID" };
  }
  if (
    typeof size !== "string" ||
    !VALID_TOKEN_SIZES.includes(size as (typeof VALID_TOKEN_SIZES)[number])
  ) {
    return { valid: false, error: "update-prop: size must be a valid TokenSize" };
  }
  return { valid: true };
}

/**
 * Validate delete-prop message
 * Required: id (string)
 */
export function validateDeletePropMessage(message: MessageRecord): ValidationResult {
  if (typeof message.id !== "string" || message.id.length === 0) {
    return { valid: false, error: "delete-prop: missing or invalid id" };
  }
  return { valid: true };
}
