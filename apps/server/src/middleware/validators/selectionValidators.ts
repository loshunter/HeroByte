// ============================================================================
// SELECTION VALIDATION
// ============================================================================
// Validates selection-related messages

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { SELECTION_MODES } from "./commonValidators.js";

/**
 * Validate select-object message
 * Required: uid (string), objectId (string)
 */
export function validateSelectObjectMessage(message: MessageRecord): ValidationResult {
  if (typeof message.uid !== "string" || message.uid.length === 0) {
    return { valid: false, error: "select-object: missing or invalid uid" };
  }
  if (typeof message.objectId !== "string" || message.objectId.length === 0) {
    return { valid: false, error: "select-object: missing or invalid objectId" };
  }
  return { valid: true };
}

/**
 * Validate deselect-object message
 * Required: uid (string)
 */
export function validateDeselectObjectMessage(message: MessageRecord): ValidationResult {
  if (typeof message.uid !== "string" || message.uid.length === 0) {
    return { valid: false, error: "deselect-object: missing or invalid uid" };
  }
  return { valid: true };
}

/**
 * Validate select-multiple message
 * Required: uid (string), objectIds (array of strings, max 100)
 * Optional: mode (selection mode: "replace", "append", "subtract")
 */
export function validateSelectMultipleMessage(message: MessageRecord): ValidationResult {
  if (typeof message.uid !== "string" || message.uid.length === 0) {
    return { valid: false, error: "select-multiple: missing or invalid uid" };
  }
  if (!Array.isArray(message.objectIds) || message.objectIds.length === 0) {
    return {
      valid: false,
      error: "select-multiple: objectIds must be a non-empty string array",
    };
  }
  if (message.objectIds.length > 100) {
    return { valid: false, error: "select-multiple: too many objectIds (max 100)" };
  }
  if (!message.objectIds.every((id) => typeof id === "string" && id.length > 0)) {
    return {
      valid: false,
      error: "select-multiple: objectIds must be a non-empty string array",
    };
  }
  if ("mode" in message && message.mode !== undefined) {
    if (typeof message.mode !== "string") {
      return { valid: false, error: "select-multiple: mode must be a string" };
    }
    if (!SELECTION_MODES.includes(message.mode as (typeof SELECTION_MODES)[number])) {
      return {
        valid: false,
        error: "select-multiple: invalid mode (replace, append, subtract)",
      };
    }
  }
  return { valid: true };
}

/**
 * Validate lock-selected message
 * Required: uid (string), objectIds (array of strings, max 100)
 */
export function validateLockSelectedMessage(message: MessageRecord): ValidationResult {
  if (typeof message.uid !== "string" || message.uid.length === 0) {
    return { valid: false, error: "lock-selected: missing or invalid uid" };
  }
  if (!Array.isArray(message.objectIds) || message.objectIds.length === 0) {
    return {
      valid: false,
      error: "lock-selected: objectIds must be a non-empty string array",
    };
  }
  if (message.objectIds.length > 100) {
    return { valid: false, error: "lock-selected: too many objectIds (max 100)" };
  }
  if (!message.objectIds.every((id) => typeof id === "string" && id.length > 0)) {
    return {
      valid: false,
      error: "lock-selected: objectIds must be a non-empty string array",
    };
  }
  return { valid: true };
}

/**
 * Validate unlock-selected message
 * Required: uid (string), objectIds (array of strings, max 100)
 */
export function validateUnlockSelectedMessage(message: MessageRecord): ValidationResult {
  if (typeof message.uid !== "string" || message.uid.length === 0) {
    return { valid: false, error: "unlock-selected: missing or invalid uid" };
  }
  if (!Array.isArray(message.objectIds) || message.objectIds.length === 0) {
    return {
      valid: false,
      error: "unlock-selected: objectIds must be a non-empty string array",
    };
  }
  if (message.objectIds.length > 100) {
    return { valid: false, error: "unlock-selected: too many objectIds (max 100)" };
  }
  if (!message.objectIds.every((id) => typeof id === "string" && id.length > 0)) {
    return {
      valid: false,
      error: "unlock-selected: objectIds must be a non-empty string array",
    };
  }
  return { valid: true };
}
