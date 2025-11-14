// ============================================================================
// PLAYER VALIDATION
// ============================================================================
// Validates player-related messages: portrait, rename, mic-level, set-hp, set-status-effects, toggle-dm

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { isFiniteNumber } from "./commonValidators.js";

/**
 * Validate portrait message (player portrait update)
 * Required: data (string, max 2MB)
 */
export function validatePortraitMessage(message: MessageRecord): ValidationResult {
  const { data } = message;
  if (typeof data !== "string") {
    return { valid: false, error: "portrait: missing or invalid data" };
  }
  if (data.length > 2 * 1024 * 1024) {
    return { valid: false, error: "portrait: data too large (max 2MB)" };
  }
  return { valid: true };
}

/**
 * Validate rename message (player name change)
 * Required: name (string, 1-50 chars)
 */
export function validateRenameMessage(message: MessageRecord): ValidationResult {
  const { name } = message;
  if (typeof name !== "string") {
    return { valid: false, error: "rename: missing or invalid name" };
  }
  if (name.length === 0 || name.length > 50) {
    return { valid: false, error: "rename: name must be 1-50 characters" };
  }
  return { valid: true };
}

/**
 * Validate mic-level message (voice chat mic level)
 * Required: level (finite number, 0-1)
 */
export function validateMicLevelMessage(message: MessageRecord): ValidationResult {
  const { level } = message;
  if (!isFiniteNumber(level) || level < 0 || level > 1) {
    return { valid: false, error: "mic-level: level must be between 0 and 1" };
  }
  return { valid: true };
}

/**
 * Validate set-hp message (player HP update)
 * Required: hp (finite non-negative number), maxHp (finite non-negative number)
 */
export function validateSetHpMessage(message: MessageRecord): ValidationResult {
  const { hp, maxHp } = message;
  if (!isFiniteNumber(hp) || !isFiniteNumber(maxHp)) {
    return { valid: false, error: "set-hp: missing or invalid hp/maxHp" };
  }
  if (hp < 0 || maxHp < 0) {
    return { valid: false, error: "set-hp: hp/maxHp cannot be negative" };
  }
  return { valid: true };
}

/**
 * Validate set-status-effects message (player status effects)
 * Required: effects (array of strings, max 16, each 1-64 chars)
 */
export function validateSetStatusEffectsMessage(message: MessageRecord): ValidationResult {
  const { effects } = message;
  if (!Array.isArray(effects)) {
    return { valid: false, error: "set-status-effects: effects must be an array" };
  }
  if (effects.length > 16) {
    return { valid: false, error: "set-status-effects: too many effects (max 16)" };
  }
  for (const effect of effects) {
    if (typeof effect !== "string") {
      return { valid: false, error: "set-status-effects: effects must be strings" };
    }
    const trimmed = effect.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: "set-status-effects: effect labels cannot be empty" };
    }
    if (trimmed.length > 64) {
      return {
        valid: false,
        error: "set-status-effects: effect labels too long (max 64 chars)",
      };
    }
  }
  return { valid: true };
}

/**
 * Validate toggle-dm message (DM status toggle)
 * Required: isDM (boolean)
 */
export function validateToggleDmMessage(message: MessageRecord): ValidationResult {
  if (typeof message.isDM !== "boolean") {
    return { valid: false, error: "toggle-dm: isDM must be boolean" };
  }
  return { valid: true };
}
