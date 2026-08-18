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

import type { MessageRecord, ValidationResult } from "./commonValidators.js";

/**
 * Validate roll-initiative message
 * Required: characterId (non-empty string)
 *
 * There is deliberately nothing else to validate. The message carries a TARGET
 * and no result — the server rolls the die itself — so unlike `set-initiative`
 * there is no number here that could be out of range or forged.
 */
export function validateRollInitiativeMessage(message: MessageRecord): ValidationResult {
  if (typeof message.characterId !== "string" || message.characterId.length === 0) {
    return { valid: false, error: "roll-initiative: missing or invalid characterId" };
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
