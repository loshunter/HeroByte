// ============================================================================
// INPUT VALIDATION MIDDLEWARE
// ============================================================================
// Validates incoming WebSocket messages to prevent malformed or malicious data

import type { ClientMessage } from "@shared";

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a client message
 * Returns { valid: true } if message is valid, or { valid: false, error: string } if invalid
 */
export function validateMessage(message: any): ValidationResult {
  // Check if message has a type field
  if (!message || typeof message.t !== "string") {
    return { valid: false, error: "Missing or invalid message type" };
  }

  const type = message.t;

  // Validate each message type
  switch (type) {
    case "move":
      if (typeof message.id !== "string") {
        return { valid: false, error: "move: missing or invalid id" };
      }
      if (typeof message.x !== "number" || typeof message.y !== "number") {
        return { valid: false, error: "move: missing or invalid x/y coordinates" };
      }
      if (!isFinite(message.x) || !isFinite(message.y)) {
        return { valid: false, error: "move: x/y must be finite numbers" };
      }
      break;

    case "recolor":
    case "delete-token":
      if (typeof message.id !== "string") {
        return { valid: false, error: `${type}: missing or invalid id` };
      }
      break;

    case "portrait":
      if (typeof message.data !== "string") {
        return { valid: false, error: "portrait: missing or invalid data" };
      }
      // Limit portrait size to 2MB base64 encoded
      if (message.data.length > 2 * 1024 * 1024) {
        return { valid: false, error: "portrait: data too large (max 2MB)" };
      }
      break;

    case "rename":
      if (typeof message.name !== "string") {
        return { valid: false, error: "rename: missing or invalid name" };
      }
      if (message.name.length === 0 || message.name.length > 50) {
        return { valid: false, error: "rename: name must be 1-50 characters" };
      }
      break;

    case "mic-level":
      if (typeof message.level !== "number") {
        return { valid: false, error: "mic-level: missing or invalid level" };
      }
      if (!isFinite(message.level) || message.level < 0 || message.level > 1) {
        return { valid: false, error: "mic-level: level must be between 0 and 1" };
      }
      break;

    case "set-hp":
      if (typeof message.hp !== "number" || typeof message.maxHp !== "number") {
        return { valid: false, error: "set-hp: missing or invalid hp/maxHp" };
      }
      if (!isFinite(message.hp) || !isFinite(message.maxHp)) {
        return { valid: false, error: "set-hp: hp/maxHp must be finite numbers" };
      }
      if (message.hp < 0 || message.maxHp < 0) {
        return { valid: false, error: "set-hp: hp/maxHp cannot be negative" };
      }
      break;

    case "map-background":
      if (typeof message.data !== "string") {
        return { valid: false, error: "map-background: missing or invalid data" };
      }
      // Limit background size to 10MB base64 encoded
      if (message.data.length > 10 * 1024 * 1024) {
        return { valid: false, error: "map-background: data too large (max 10MB)" };
      }
      break;

    case "grid-size":
      if (typeof message.size !== "number") {
        return { valid: false, error: "grid-size: missing or invalid size" };
      }
      if (!isFinite(message.size) || message.size < 10 || message.size > 500) {
        return { valid: false, error: "grid-size: size must be between 10 and 500" };
      }
      break;

    case "point":
      if (typeof message.x !== "number" || typeof message.y !== "number") {
        return { valid: false, error: "point: missing or invalid x/y coordinates" };
      }
      if (!isFinite(message.x) || !isFinite(message.y)) {
        return { valid: false, error: "point: x/y must be finite numbers" };
      }
      break;

    case "draw":
      if (!message.drawing || typeof message.drawing !== "object") {
        return { valid: false, error: "draw: missing or invalid drawing object" };
      }
      // Validate drawing structure
      const drawing = message.drawing;
      if (!drawing.id || !drawing.type || !Array.isArray(drawing.points)) {
        return { valid: false, error: "draw: invalid drawing structure" };
      }
      // Limit drawing complexity
      if (drawing.points.length > 10000) {
        return { valid: false, error: "draw: too many points (max 10000)" };
      }
      break;

    case "undo-drawing":
    case "clear-drawings":
    case "deselect-drawing":
    case "clear-roll-history":
    case "clear-all-tokens":
    case "heartbeat":
      // No additional validation needed
      break;

    case "select-drawing":
    case "delete-drawing":
      if (typeof message.id !== "string" || message.id.length === 0) {
        return { valid: false, error: `${message.t}: missing or invalid drawing id` };
      }
      break;

    case "move-drawing":
      if (typeof message.id !== "string" || message.id.length === 0) {
        return { valid: false, error: "move-drawing: missing or invalid drawing id" };
      }
      if (typeof message.dx !== "number" || typeof message.dy !== "number") {
        return { valid: false, error: "move-drawing: dx and dy must be numbers" };
      }
      break;

    case "dice-roll":
      if (!message.roll || typeof message.roll !== "object") {
        return { valid: false, error: "dice-roll: missing or invalid roll object" };
      }
      break;

    case "rtc-signal":
      if (typeof message.target !== "string") {
        return { valid: false, error: "rtc-signal: missing or invalid target" };
      }
      if (!message.signal) {
        return { valid: false, error: "rtc-signal: missing signal data" };
      }
      break;

    default:
      return { valid: false, error: `Unknown message type: ${type}` };
  }

  return { valid: true };
}
