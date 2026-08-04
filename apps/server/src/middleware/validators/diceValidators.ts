// ============================================================================
// DICE VALIDATION
// ============================================================================
// Its own module rather than a block in roomValidators.ts, which sits close
// enough to the 350-LOC guardrail that adding to it trips the structure gate.
//
// Note what is NOT validated here: any notion of the roller, the total, or the
// individual die faces. A dice-roll message carries no identity and no result
// at all — the server rolls it and stamps the author from the connection. The
// old validator bounded `playerUid`, `playerName` and `total` because they
// arrived on the wire; bounding a forgeable field is not the same as refusing
// to accept one (arc defect D2).

import { parseDiceFormula } from "@herobyte/shared";
import type { ValidationResult, MessageRecord } from "./commonValidators.js";

const ROLL_MODES = new Set(["normal", "advantage", "disadvantage"]);
const VISIBILITIES = new Set(["public", "dm", "self"]);

/**
 * `{ t: "dice-roll"; formula: string; mode?; visibility? }`
 *
 * The formula check IS `parseDiceFormula` — the same function the handler uses
 * to produce terms. Reusing it rather than writing a looser shape check here
 * means there is no formula the gate admits and the roller then chokes on, and
 * every ceiling (term count, dice count, modifier size) is enforced in one
 * place rather than two that can drift.
 *
 * `mode` and `visibility` are REJECTED when unrecognized rather than coerced.
 * The handler coerces too — defence in depth for the load/restore paths — but
 * a live client sending nonsense should be told, not silently downgraded into
 * a roll it did not ask for.
 */
export function validateDiceRollMessage(message: MessageRecord): ValidationResult {
  const parsed = parseDiceFormula(message.formula);
  if (!parsed.ok) {
    return { valid: false, error: `dice-roll: ${parsed.error}` };
  }

  if (message.mode !== undefined && !ROLL_MODES.has(message.mode as string)) {
    return { valid: false, error: "dice-roll: mode must be normal, advantage or disadvantage" };
  }

  if (message.visibility !== undefined && !VISIBILITIES.has(message.visibility as string)) {
    return { valid: false, error: "dice-roll: visibility must be public, dm or self" };
  }

  return { valid: true };
}
