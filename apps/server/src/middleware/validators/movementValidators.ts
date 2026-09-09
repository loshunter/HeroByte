/**
 * Movement-budget message validators. Their own module: characterValidators
 * sits at the 350-line ceiling.
 */

import { MOVEMENT_SPEED_MAX_FEET, MOVEMENT_SPEED_MIN_FEET } from "@herobyte/shared";
import type { MessageRecord, ValidationResult } from "./index.js";

/**
 * set-character-speed: a finite number of feet per turn inside the shared
 * bounds. Not an integer check — a 2.5 ft speed is odd but not malformed.
 */
export function validateSetCharacterSpeedMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "set-character-speed: missing or invalid characterId" };
  }
  const { speed } = message;
  if (typeof speed !== "number" || !Number.isFinite(speed)) {
    return { valid: false, error: "set-character-speed: speed must be a number" };
  }
  if (speed < MOVEMENT_SPEED_MIN_FEET || speed > MOVEMENT_SPEED_MAX_FEET) {
    return {
      valid: false,
      error: `set-character-speed: speed must be ${MOVEMENT_SPEED_MIN_FEET} to ${MOVEMENT_SPEED_MAX_FEET}`,
    };
  }
  return { valid: true };
}
