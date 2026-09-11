/**
 * Movement-budget message validators. Their own module: characterValidators
 * sits at the 350-line ceiling.
 */

import {
  MAX_STEP_OBJECTS,
  MOVEMENT_SPEED_MAX_FEET,
  MOVEMENT_SPEED_MIN_FEET,
} from "@herobyte/shared";
import type { MessageRecord, ValidationResult } from "./index.js";

const STEP = new Set([-1, 0, 1]);
/** The kinds whose transform is in grid CELLS; a drawing's is in pixels, so "one cell" is a lie there. */
const STEPPABLE = /^(token|prop):./;

/**
 * step-object: one grid cell from each object's current cell, ONE message for
 * the whole selection. The client sends a DIRECTION, never a cell, so it can
 * never ask for a cell the token is not next to — the server resolves every
 * target from its own authoritative position
 * (TransformMessageHandler.handleStepObjects).
 */
export function validateStepObjectMessage(message: MessageRecord): ValidationResult {
  const { ids, dx, dy } = message;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_STEP_OBJECTS) {
    return { valid: false, error: `step-object: ids must name 1 to ${MAX_STEP_OBJECTS} objects` };
  }
  if (!ids.every((id) => typeof id === "string" && STEPPABLE.test(id))) {
    return { valid: false, error: "step-object: every id must name a token or a prop" };
  }
  if (new Set(ids).size !== ids.length) {
    return { valid: false, error: "step-object: an object may appear once" };
  }
  if (!STEP.has(dx as number) || !STEP.has(dy as number)) {
    return { valid: false, error: "step-object: dx and dy must each be -1, 0 or 1" };
  }
  if (dx === 0 && dy === 0) {
    return { valid: false, error: "step-object: a step must move" };
  }
  return { valid: true };
}

/** reset-movement-budget: a non-empty string characterId — the DM zeroes its spend. */
export function validateResetMovementBudgetMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "reset-movement-budget: missing or invalid characterId" };
  }
  return { valid: true };
}

/**
 * set-character-speed: a finite number of feet per turn inside the shared
 * bounds. Not an integer check — a 2.5 ft speed is odd but not malformed.
 */
export function validateSetCharacterSpeedMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "set-character-speed: missing or invalid characterId" };
  }
  const { speed } = message;
  // null = "back to the shared default" (the field emptied).
  if (speed === null) return { valid: true };
  if (typeof speed !== "number" || !Number.isFinite(speed)) {
    return { valid: false, error: "set-character-speed: speed must be a number or null" };
  }
  if (speed < MOVEMENT_SPEED_MIN_FEET || speed > MOVEMENT_SPEED_MAX_FEET) {
    return {
      valid: false,
      error: `set-character-speed: speed must be ${MOVEMENT_SPEED_MIN_FEET} to ${MOVEMENT_SPEED_MAX_FEET}`,
    };
  }
  return { valid: true };
}
