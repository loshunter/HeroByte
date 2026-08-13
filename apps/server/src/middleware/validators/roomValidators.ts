// ============================================================================
// ROOM VALIDATION
// ============================================================================
// Validates room management, session, and auth messages

import { VISION_RADIUS_MAX_FEET, VISION_RADIUS_MIN_FEET } from "@herobyte/shared";
import type { ValidationResult, MessageRecord } from "./commonValidators.js";
import { isRecord, isFiniteNumber, validateStagingZone } from "./commonValidators.js";
import { STRING_LIMITS } from "./constants.js";

/**
 * Validate set-default-vision-radius message
 * Required: radius (null for no table default, or feet in range)
 *
 * Mirrors validateSetTokenVisionRadiusMessage minus the tokenId, and borrows
 * the same shared bounds so the validator and the geometry cannot drift. An
 * ABSENT radius is refused rather than read as null: clearing the default is a
 * deliberate act and must be spelled.
 */
export function validateSetDefaultVisionRadiusMessage(message: MessageRecord): ValidationResult {
  if (message.radius === null) {
    return { valid: true };
  }
  if (!isFiniteNumber(message.radius)) {
    return { valid: false, error: "set-default-vision-radius: radius must be a number or null" };
  }
  if (message.radius < VISION_RADIUS_MIN_FEET || message.radius > VISION_RADIUS_MAX_FEET) {
    return {
      valid: false,
      error: `set-default-vision-radius: radius must be between ${VISION_RADIUS_MIN_FEET} and ${VISION_RADIUS_MAX_FEET} feet`,
    };
  }
  return { valid: true };
}

/**
 * Validate set-player-staging-zone message
 * Required: zone (staging zone object or null/undefined)
 */
export function validateSetPlayerStagingZoneMessage(message: MessageRecord): ValidationResult {
  return validateStagingZone(message.zone, "set-player-staging-zone");
}

/**
 * Validate set-room-password message
 * Optional: secret (non-empty string, max 256 chars). An omitted secret is a
 * reset request — the server falls back to its own configured default, so the
 * client never has to know (or hard-code) that value.
 */
export function validateSetRoomPasswordMessage(message: MessageRecord): ValidationResult {
  if (message.secret === undefined) {
    return { valid: true };
  }
  if (typeof message.secret !== "string") {
    return { valid: false, error: "set-room-password: secret must be a string" };
  }
  const trimmed = message.secret.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "set-room-password: secret is empty" };
  }
  if (trimmed.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "set-room-password: secret too long" };
  }
  return { valid: true };
}

/**
 * Validate simple room control messages (no parameters)
 */
export function validateRoomControlMessage(): ValidationResult {
  return { valid: true };
}

/**
 * Validate authenticate message
 * Required: secret (non-empty string, max 256 chars)
 * Optional: roomId (string)
 */
export function validateAuthenticateMessage(message: MessageRecord): ValidationResult {
  if (typeof message.secret !== "string" || message.secret.length === 0) {
    return { valid: false, error: "authenticate: missing or invalid secret" };
  }
  if (message.secret.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "authenticate: secret too long" };
  }
  if ("roomId" in message && message.roomId !== undefined && typeof message.roomId !== "string") {
    return { valid: false, error: "authenticate: roomId must be a string" };
  }
  return { valid: true };
}

export function validateCreateRoomMessage(message: MessageRecord): ValidationResult {
  if (typeof message.roomId !== "string" || message.roomId.length === 0) {
    return { valid: false, error: "create-room: missing or invalid roomId" };
  }
  if (message.roomId.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "create-room: roomId too long" };
  }
  if (typeof message.roomPassword !== "string" || message.roomPassword.length === 0) {
    return { valid: false, error: "create-room: missing or invalid roomPassword" };
  }
  if (message.roomPassword.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "create-room: roomPassword too long" };
  }
  if (
    "dmPassword" in message &&
    message.dmPassword !== undefined &&
    (typeof message.dmPassword !== "string" || message.dmPassword.length > STRING_LIMITS.SECRET_MAX)
  ) {
    return { valid: false, error: "create-room: dmPassword must be a short string" };
  }
  return { valid: true };
}

/**
 * Validate elevate-to-dm message
 * Required: dmPassword (non-empty string, max 256 chars)
 */
export function validateElevateToDmMessage(message: MessageRecord): ValidationResult {
  if (typeof message.dmPassword !== "string" || message.dmPassword.length === 0) {
    return { valid: false, error: "elevate-to-dm: missing or invalid dmPassword" };
  }
  if (message.dmPassword.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "elevate-to-dm: dmPassword too long" };
  }
  return { valid: true };
}

/**
 * Validate set-dm-password message
 * Required: dmPassword (non-empty string, max 256 chars)
 */
export function validateSetDmPasswordMessage(message: MessageRecord): ValidationResult {
  if (typeof message.dmPassword !== "string" || message.dmPassword.length === 0) {
    return { valid: false, error: "set-dm-password: missing or invalid dmPassword" };
  }
  if (message.dmPassword.length > STRING_LIMITS.SECRET_MAX) {
    return { valid: false, error: "set-dm-password: dmPassword too long" };
  }
  return { valid: true };
}

/**
 * Validate transform-object message
 * Required: id (string)
 * Optional: position ({x, y}), scale ({x, y}, positive), rotation (number), locked (boolean)
 */
export function validateTransformObjectMessage(message: MessageRecord): ValidationResult {
  if (typeof message.id !== "string" || message.id.length === 0) {
    return { valid: false, error: "transform-object: missing or invalid id" };
  }

  if ("position" in message && message.position !== undefined) {
    const pos = message.position;
    if (!isRecord(pos) || !isFiniteNumber(pos.x) || !isFiniteNumber(pos.y)) {
      return { valid: false, error: "transform-object: invalid position" };
    }
  }

  if ("scale" in message && message.scale !== undefined) {
    const scale = message.scale;
    if (!isRecord(scale) || !isFiniteNumber(scale.x) || !isFiniteNumber(scale.y)) {
      return { valid: false, error: "transform-object: invalid scale" };
    }
    if (scale.x <= 0 || scale.y <= 0) {
      return { valid: false, error: "transform-object: scale must be positive" };
    }
    // Staging zone handles scale differently (converts to width/height), so skip strict limits
    const isStagingZone = message.id === "staging-zone";
    if (!isStagingZone) {
      // Prevent extreme scale values that can break rendering
      if (scale.x > 10 || scale.y > 10) {
        return { valid: false, error: "transform-object: scale must not exceed 10x" };
      }
      if (scale.x < 0.1 || scale.y < 0.1) {
        return { valid: false, error: "transform-object: scale must be at least 0.1x" };
      }
    }
  }

  if ("rotation" in message && message.rotation !== undefined) {
    if (!isFiniteNumber(message.rotation)) {
      return { valid: false, error: "transform-object: rotation must be a number" };
    }
  }

  if ("locked" in message && message.locked !== undefined) {
    if (typeof message.locked !== "boolean") {
      return { valid: false, error: "transform-object: locked must be a boolean" };
    }
  }

  return { valid: true };
}

/**
 * Validate request-room-resync message
 * Optional: lastSeenVersion (non-negative finite number), reason (string, max 256 chars)
 */
export function validateRequestRoomResyncMessage(message: MessageRecord): ValidationResult {
  if (message.lastSeenVersion !== undefined) {
    if (!isFiniteNumber(message.lastSeenVersion) || message.lastSeenVersion < 0) {
      return {
        valid: false,
        error: "request-room-resync: lastSeenVersion must be a non-negative number",
      };
    }
  }
  if (message.reason !== undefined) {
    if (typeof message.reason !== "string" || message.reason.length > 256) {
      return {
        valid: false,
        error: "request-room-resync: reason must be a string (max 256 chars)",
      };
    }
  }
  return { valid: true };
}

/**
 * Validate rtc-signal message
 * Required: target (string), signal (any)
 */
export function validateRtcSignalMessage(message: MessageRecord): ValidationResult {
  if (typeof message.target !== "string") {
    return { valid: false, error: "rtc-signal: missing or invalid target" };
  }
  if (!("signal" in message)) {
    return { valid: false, error: "rtc-signal: missing signal data" };
  }
  return { valid: true };
}
