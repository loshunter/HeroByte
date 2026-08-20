/**
 * Initiative rolling validators
 *
 * A separate file rather than three more functions in characterValidators.ts,
 * which sits at 348 lines against a guard that flags at 350 — it has no legal
 * lines left, so it is on the extract-before-you-touch list. `set-initiative`
 * and the combat-control messages stay there; the rolling messages live here.
 *
 * @module middleware/validators/initiativeValidators
 */

import {
  isInitiativeModifier,
  type MessageRecord,
  type ValidationResult,
} from "./commonValidators.js";

/**
 * Validate roll-initiative message
 * Required: characterId (non-empty string)
 * Optional: modifier (finite number)
 *
 * No RESULT is validated here because none is carried — the server rolls the
 * die itself, so there is no d20 value off the wire that could be forged.
 *
 * `modifier` is the exception, and it is not a result: it is the character's
 * own stat, arriving so that dragging the modal's dial and rolling can be one
 * gesture. It is bounded to the same range both client editors clamp to, and
 * `set-initiative` now enforces the identical bound on its own copy of the
 * field — a limit on one path only would be a limit on neither, since either
 * message can write the stored modifier through applyInitiative.
 *
 * An earlier version accepted any finite number here, reasoning that it merely
 * matched what `set-initiative` already allowed. That was true and still wrong:
 * it left `{ modifier: 9999 }` as a way to pick your own initiative at a table
 * whose DM had turned hand-entry off precisely to stop that.
 */
export function validateRollInitiativeMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "roll-initiative: missing or invalid characterId" };
  }
  if (message.modifier !== undefined && !isInitiativeModifier(message.modifier)) {
    return { valid: false, error: "roll-initiative: modifier out of range" };
  }
  return { valid: true };
}

/**
 * Validate roll-initiative-all message
 *
 * Carries no fields at all: the server decides which NPCs still need a roll.
 * DM-only, but that is an authorization question the dispatcher answers, not a
 * shape question — validators here check shape only.
 */
export function validateRollInitiativeAllMessage(): ValidationResult {
  return { valid: true };
}

/**
 * Validate set-initiative-manual-override message
 * Required: enabled (boolean)
 */
export function validateSetInitiativeManualOverrideMessage(
  message: MessageRecord,
): ValidationResult {
  if (typeof message.enabled !== "boolean") {
    return { valid: false, error: "set-initiative-manual-override: enabled must be a boolean" };
  }
  return { valid: true };
}
