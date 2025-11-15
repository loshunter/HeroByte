// ============================================================================
// MAP VALIDATION
// ============================================================================
// Validates map and drawing-related messages

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import {
  isFiniteNumber,
  validateDrawingPayload,
  validatePartialSegment,
  MAX_PARTIAL_SEGMENTS,
} from "./commonValidators.js";
import { PAYLOAD_LIMITS, RANGE_LIMITS, ARRAY_LIMITS } from "./constants.js";

/**
 * Validate map-background message
 * Required: data (string, max 10MB)
 */
export function validateMapBackgroundMessage(message: MessageRecord): ValidationResult {
  const { data } = message;
  if (typeof data !== "string") {
    return { valid: false, error: "map-background: missing or invalid data" };
  }
  if (data.length > PAYLOAD_LIMITS.MAP_SIZE) {
    return { valid: false, error: "map-background: data too large (max 10MB)" };
  }
  return { valid: true };
}

/**
 * Validate grid-size message
 * Required: size (finite number, 10-500)
 */
export function validateGridSizeMessage(message: MessageRecord): ValidationResult {
  const { size } = message;
  if (
    !isFiniteNumber(size) ||
    size < RANGE_LIMITS.GRID_SIZE_MIN ||
    size > RANGE_LIMITS.GRID_SIZE_MAX
  ) {
    return { valid: false, error: "grid-size: size must be between 10 and 500" };
  }
  return { valid: true };
}

/**
 * Validate grid-square-size message
 * Required: size (finite number, 0.1-100)
 */
export function validateGridSquareSizeMessage(message: MessageRecord): ValidationResult {
  const { size } = message;
  if (
    !isFiniteNumber(size) ||
    size < RANGE_LIMITS.GRID_SQUARE_SIZE_MIN ||
    size > RANGE_LIMITS.GRID_SQUARE_SIZE_MAX
  ) {
    return { valid: false, error: "grid-square-size: size must be between 0.1 and 100 feet" };
  }
  return { valid: true };
}

/**
 * Validate point message (pointer/cursor position)
 * Required: x (finite number), y (finite number)
 */
export function validatePointMessage(message: MessageRecord): ValidationResult {
  const { x, y } = message;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return { valid: false, error: "point: missing or invalid x/y coordinates" };
  }
  return { valid: true };
}

/**
 * Validate draw message
 * Required: drawing (valid drawing payload)
 */
export function validateDrawMessage(message: MessageRecord): ValidationResult {
  return validateDrawingPayload(message.drawing, "draw");
}

/**
 * Validate simple drawing control messages (no parameters)
 */
export function validateDrawingControlMessage(): ValidationResult {
  return { valid: true };
}

/**
 * Validate select-drawing or delete-drawing message
 * Required: id (string)
 */
export function validateDrawingIdMessage(
  message: MessageRecord,
  messageType: string,
): ValidationResult {
  if (typeof message.id !== "string" || message.id.length === 0) {
    return { valid: false, error: `${messageType}: missing or invalid drawing id` };
  }
  return { valid: true };
}

/**
 * Validate move-drawing message
 * Required: id (string), dx (finite number), dy (finite number)
 */
export function validateMoveDrawingMessage(message: MessageRecord): ValidationResult {
  const { id, dx, dy } = message;
  if (typeof id !== "string" || id.length === 0) {
    return { valid: false, error: "move-drawing: missing or invalid drawing id" };
  }
  if (!isFiniteNumber(dx) || !isFiniteNumber(dy)) {
    return { valid: false, error: "move-drawing: dx and dy must be numbers" };
  }
  return { valid: true };
}

/**
 * Validate erase-partial message
 * Required: deleteId (string), segments (array of partial segments, max 50)
 */
export function validateErasePartialMessage(message: MessageRecord): ValidationResult {
  if (typeof message.deleteId !== "string" || message.deleteId.length === 0) {
    return { valid: false, error: "erase-partial: missing deleteId" };
  }
  if (!Array.isArray(message.segments)) {
    return { valid: false, error: "erase-partial: segments must be an array" };
  }
  if (message.segments.length > MAX_PARTIAL_SEGMENTS) {
    return {
      valid: false,
      error: `erase-partial: too many segments (max ${MAX_PARTIAL_SEGMENTS})`,
    };
  }
  for (let index = 0; index < message.segments.length; index += 1) {
    const validation = validatePartialSegment(message.segments[index], index);
    if (!validation.valid) {
      return validation;
    }
  }
  return { valid: true };
}

/**
 * Validate sync-player-drawings message
 * Required: drawings (array of drawings, max 200)
 */
export function validateSyncPlayerDrawingsMessage(message: MessageRecord): ValidationResult {
  if (!Array.isArray(message.drawings)) {
    return { valid: false, error: "sync-player-drawings: drawings must be an array" };
  }
  if (message.drawings.length > ARRAY_LIMITS.SYNCED_DRAWINGS) {
    return { valid: false, error: "sync-player-drawings: too many drawings (max 200)" };
  }
  for (let index = 0; index < message.drawings.length; index += 1) {
    const validation = validateDrawingPayload(
      message.drawings[index],
      `sync-player-drawings[${index}]`,
    );
    if (!validation.valid) {
      return validation;
    }
  }
  return { valid: true };
}
