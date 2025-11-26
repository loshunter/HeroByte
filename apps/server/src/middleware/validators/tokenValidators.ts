// ============================================================================
// TOKEN VALIDATION
// ============================================================================
// Validates token-related messages: move, recolor, delete, update-image, set-size, set-color

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { isFiniteNumber, isRecord, VALID_TOKEN_SIZES } from "./commonValidators.js";
import { STRING_LIMITS } from "./constants.js";

/**
 * Validate move message (token movement)
 * Required: id (string), x (finite number), y (finite number)
 */
export function validateMoveMessage(message: MessageRecord): ValidationResult {
  const { id, x, y } = message;
  if (typeof id !== "string") {
    return { valid: false, error: "move: missing or invalid id" };
  }
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return { valid: false, error: "move: missing or invalid x/y coordinates" };
  }
  return { valid: true };
}

/**
 * Validate recolor message
 * Required: id (string)
 */
export function validateRecolorMessage(message: MessageRecord): ValidationResult {
  if (typeof message.id !== "string") {
    return { valid: false, error: "recolor: missing or invalid id" };
  }
  return { valid: true };
}

/**
 * Validate delete-token message
 * Required: id (string)
 */
export function validateDeleteTokenMessage(message: MessageRecord): ValidationResult {
  if (typeof message.id !== "string") {
    return { valid: false, error: "delete-token: missing or invalid id" };
  }
  return { valid: true };
}

/**
 * Validate update-token-image message
 * Required: tokenId (string), imageUrl (string, max 2048 chars)
 */
export function validateUpdateTokenImageMessage(message: MessageRecord): ValidationResult {
  if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
    return { valid: false, error: "update-token-image: missing or invalid tokenId" };
  }
  if (typeof message.imageUrl !== "string") {
    return { valid: false, error: "update-token-image: imageUrl must be a string" };
  }
  if (message.imageUrl.length > STRING_LIMITS.IMAGE_URL_MAX) {
    return { valid: false, error: "update-token-image: imageUrl too long (max 2048 chars)" };
  }
  return { valid: true };
}

/**
 * Validate set-token-size message
 * Required: tokenId (string), size (valid TokenSize enum)
 */
export function validateSetTokenSizeMessage(message: MessageRecord): ValidationResult {
  if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
    return { valid: false, error: "set-token-size: tokenId required" };
  }
  if (typeof message.size !== "string") {
    return { valid: false, error: "set-token-size: size must be a string" };
  }
  if (!VALID_TOKEN_SIZES.includes(message.size as (typeof VALID_TOKEN_SIZES)[number])) {
    return {
      valid: false,
      error: "set-token-size: invalid size (must be tiny/small/medium/large/huge/gargantuan)",
    };
  }
  return { valid: true };
}

/**
 * Validate set-token-color message
 * Required: tokenId (string), color (non-empty string, max 128 chars)
 */
export function validateSetTokenColorMessage(message: MessageRecord): ValidationResult {
  if (typeof message.tokenId !== "string" || message.tokenId.length === 0) {
    return { valid: false, error: "set-token-color: tokenId required" };
  }
  if (typeof message.color !== "string") {
    return { valid: false, error: "set-token-color: color must be a string" };
  }
  const trimmed = message.color.trim();
  if (trimmed.length < STRING_LIMITS.COLOR_MIN) {
    return { valid: false, error: "set-token-color: color cannot be empty" };
  }
  if (trimmed.length > STRING_LIMITS.COLOR_MAX) {
    return { valid: false, error: "set-token-color: color too long (max 128 chars)" };
  }
  return { valid: true };
}

/**
 * Validate drag-preview message
 * Required: objects (array of { id: string; x: number; y: number })
 */
export function validateDragPreviewMessage(message: MessageRecord): ValidationResult {
  if (!Array.isArray(message.objects)) {
    return { valid: false, error: "drag-preview: objects must be an array" };
  }

  if (message.objects.length === 0) {
    return { valid: false, error: "drag-preview: objects cannot be empty" };
  }

  for (let index = 0; index < message.objects.length; index++) {
    const entry = message.objects[index];
    if (!isRecord(entry)) {
      return { valid: false, error: `drag-preview: object ${index} must be an object` };
    }

    if (typeof entry.id !== "string" || entry.id.length === 0) {
      return { valid: false, error: `drag-preview: object ${index} missing id` };
    }

    if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.y)) {
      return { valid: false, error: `drag-preview: object ${index} missing coordinates` };
    }
  }

  return { valid: true };
}
