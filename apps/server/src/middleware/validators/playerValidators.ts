// ============================================================================
// PLAYER VALIDATION
// ============================================================================
// Validates player-related messages: portrait, rename, mic-level, set-hp,
// set-status-effects, toggle-dm, remove-player

import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { isFiniteNumber } from "./commonValidators.js";
import { PAYLOAD_LIMITS, STRING_LIMITS, ARRAY_LIMITS, RANGE_LIMITS } from "./constants.js";

/**
 * Validate portrait message (player portrait update)
 * Required: data (string, max 2MB)
 */
export function validatePortraitMessage(message: MessageRecord): ValidationResult {
  const { data } = message;
  if (typeof data !== "string") {
    return { valid: false, error: "portrait: missing or invalid data" };
  }
  if (data.length > PAYLOAD_LIMITS.PORTRAIT_SIZE) {
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
  if (name.length < STRING_LIMITS.PLAYER_NAME_MIN || name.length > STRING_LIMITS.PLAYER_NAME_MAX) {
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
  if (
    !isFiniteNumber(level) ||
    level < RANGE_LIMITS.MIC_LEVEL_MIN ||
    level > RANGE_LIMITS.MIC_LEVEL_MAX
  ) {
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
  if (effects.length > ARRAY_LIMITS.STATUS_EFFECTS) {
    return { valid: false, error: "set-status-effects: too many effects (max 16)" };
  }
  for (const effect of effects) {
    if (typeof effect !== "string") {
      return { valid: false, error: "set-status-effects: effects must be strings" };
    }
    const trimmed = effect.trim();
    if (trimmed.length < STRING_LIMITS.STATUS_EFFECT_MIN) {
      return { valid: false, error: "set-status-effects: effect labels cannot be empty" };
    }
    if (trimmed.length > STRING_LIMITS.STATUS_EFFECT_MAX) {
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

/**
 * Validate remove-player message (the DM clears an absent player's seat)
 * Required: uid (string, 1-128 chars)
 */
export function validateRemovePlayerMessage(message: MessageRecord): ValidationResult {
  const { uid } = message;
  // The alphabet and length a uid can have at all — the connect handshake's
  // rule (ws/lifecycle/ConnectionLifecycleManager.ts), not a coincidence of 128.
  if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    return { valid: false, error: "remove-player: missing or invalid uid" };
  }
  return { valid: true };
}
