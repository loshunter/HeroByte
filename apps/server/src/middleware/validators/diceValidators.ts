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
import { isIntegerInRange } from "./commonValidators.js";
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

/**
 * The widest total a hand-entered result may claim.
 *
 * A bound rather than a free number, and generous rather than tight: the point
 * is to stop a client writing an absurd value into shared history, not to
 * police what dice a table owns. A hundred d100s and a fat modifier still fit
 * comfortably inside it, so no legitimate physical roll is ever refused.
 *
 * Integers only. A physical die does not land on 7.5, and a fractional total
 * would render as noise in a log every player reads.
 */
const ENTERED_TOTAL_LIMIT = 100000;

/**
 * `{ t: "enter-roll"; rollId?; total; formula?; visibility? }`
 *
 * The one message that carries a RESULT, so it is the one place the shape gate
 * has to think about a number the client chose. Shape only: whether this sender
 * may rewrite THAT roll is an authorization question, and it is answered in the
 * handler where the roll and the room are both in hand.
 *
 * `formula` is checked with `parseDiceFormula` when present, for the same
 * reason `dice-roll` does — one definition of what notation means. It is
 * optional because a bare entry ("I rolled 17, put it on the table") is the
 * fastest path at a physical table and carries no notation at all.
 */
export function validateEnterRollMessage(message: MessageRecord): ValidationResult {
  if (!isIntegerInRange(message.total, -ENTERED_TOTAL_LIMIT, ENTERED_TOTAL_LIMIT)) {
    return { valid: false, error: "enter-roll: total must be a whole number within range" };
  }

  if (message.rollId !== undefined) {
    if (typeof message.rollId !== "string" || message.rollId.length === 0) {
      return { valid: false, error: "enter-roll: rollId must be a non-empty string" };
    }
  }

  if (message.formula !== undefined) {
    const parsed = parseDiceFormula(message.formula);
    if (!parsed.ok) {
      return { valid: false, error: `enter-roll: ${parsed.error}` };
    }
  }

  if (message.visibility !== undefined && !VISIBILITIES.has(message.visibility as string)) {
    return { valid: false, error: "enter-roll: visibility must be public, dm or self" };
  }

  return { valid: true };
}
