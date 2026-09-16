// ============================================================================
// NPC VALIDATION
// ============================================================================
// Validates the NPC create/update messages. Split out of characterValidators,
// which sat at the 350-line ceiling when create-npc grew a tokenSize.

import { NPC_CREATE_LIMITS } from "@herobyte/shared";
import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import {
  isFiniteNumber,
  isIntegerInRange,
  isNpcDisposition,
  isTokenSize,
} from "./commonValidators.js";
import { STRING_LIMITS } from "./constants.js";

/**
 * Validate create-npc message
 * Required: name (string, 1-50 chars), hp (positive), maxHp (positive)
 * Optional: portrait (string), tokenImage (string), tempHp (non-negative),
 * count (integer 1..NPC_CREATE_LIMITS.COUNT_MAX)
 */
export function validateCreateNpcMessage(message: MessageRecord): ValidationResult {
  const { name, hp, maxHp, tempHp, portrait, tokenImage, tokenSize, disposition, count } = message;
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > STRING_LIMITS.PLAYER_NAME_MAX
  ) {
    return { valid: false, error: "create-npc: name must be 1-50 characters" };
  }
  // A downed NPC at 0 hp is ordinary everywhere else: update-npc admits it and
  // createCharacter clamps with Math.max(0, …). Only create-npc refused it, and
  // S8's Duplicate made that reachable by replaying the source's own hp — so
  // duplicating a goblin knocked to 0 was dropped silently and surfaced to the
  // DM as "NPC creation timed out", forever. maxHp must still be positive.
  if (!isFiniteNumber(hp) || hp < 0) {
    return { valid: false, error: "create-npc: hp must not be negative" };
  }
  if (!isFiniteNumber(maxHp) || maxHp <= 0) {
    return { valid: false, error: "create-npc: maxHp must be positive" };
  }
  if (tempHp !== undefined && (!isFiniteNumber(tempHp) || tempHp < 0)) {
    return { valid: false, error: "create-npc: tempHp must be non-negative" };
  }
  if (portrait !== undefined && typeof portrait !== "string") {
    return { valid: false, error: "create-npc: portrait must be a string" };
  }
  if (typeof tokenImage !== "undefined" && typeof tokenImage !== "string") {
    return { valid: false, error: "create-npc: tokenImage must be a string" };
  }
  // The placed token is born at this size (a library pick's default); a value
  // off the ladder is refused, not defaulted, as set-token-size refuses it.
  if (tokenSize !== undefined && !isTokenSize(tokenSize)) {
    return { valid: false, error: "create-npc: tokenSize must be a token size" };
  }
  // Refused rather than defaulted, like tokenSize: absent already MEANS
  // hostile, so a word off the list is a broken client, not a missing value.
  if (disposition !== undefined && !isNpcDisposition(disposition)) {
    return { valid: false, error: "create-npc: disposition must be a stance" };
  }
  // The handler LOOPS on count, so this bound is load-bearing, not cosmetic —
  // and the RANGE is what enforces it, since Number.isInteger(1e308) is true.
  // Rejected rather than clamped: a client asking for 10_000 goblins is
  // broken, and quietly handing it 20 would hide that.
  const { COUNT_MIN, COUNT_MAX } = NPC_CREATE_LIMITS;
  if (count !== undefined && !isIntegerInRange(count, COUNT_MIN, COUNT_MAX)) {
    return {
      valid: false,
      error: `create-npc: count must be an integer between ${COUNT_MIN} and ${COUNT_MAX}`,
    };
  }
  return { valid: true };
}

/**
 * Validate update-npc message
 * Required: id (string), name (string, 1-50 chars), hp (non-negative), maxHp (positive)
 * Optional: portrait (string), tokenImage (string), tempHp (non-negative), initiativeModifier (number)
 */
export function validateUpdateNpcMessage(message: MessageRecord): ValidationResult {
  const { id, name, hp, maxHp, tempHp, portrait, tokenImage, initiativeModifier, disposition } =
    message;
  if (typeof id !== "string" || id.length === 0) {
    return { valid: false, error: "update-npc: missing or invalid id" };
  }
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.length > STRING_LIMITS.PLAYER_NAME_MAX
  ) {
    return { valid: false, error: "update-npc: name must be 1-50 characters" };
  }
  if (!isFiniteNumber(hp) || hp < 0) {
    return { valid: false, error: "update-npc: hp must be non-negative" };
  }
  if (!isFiniteNumber(maxHp) || maxHp <= 0) {
    return { valid: false, error: "update-npc: maxHp must be positive" };
  }
  if (tempHp !== undefined && (!isFiniteNumber(tempHp) || tempHp < 0)) {
    return { valid: false, error: "update-npc: tempHp must be non-negative" };
  }
  if (portrait !== undefined && typeof portrait !== "string") {
    return { valid: false, error: "update-npc: portrait must be a string" };
  }
  if (tokenImage !== undefined && typeof tokenImage !== "string") {
    return { valid: false, error: "update-npc: tokenImage must be a string" };
  }
  if (initiativeModifier !== undefined && !isFiniteNumber(initiativeModifier)) {
    return { valid: false, error: "update-npc: initiativeModifier must be a number" };
  }
  if (disposition !== undefined && !isNpcDisposition(disposition)) {
    return { valid: false, error: "update-npc: disposition must be a stance" };
  }
  return { valid: true };
}
