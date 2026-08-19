/**
 * initiativeRollRecord
 *
 * Shapes the roll-log line for a MANUAL initiative entry — the case where a
 * player physically rolled at the table, the DM allowed it, and the number is
 * typed in. The table should see that as a roll, not as a silent change.
 *
 * The rolled path does not come through here: it goes through
 * `DiceService.rollFor`, which builds its own breakdown from terms it actually
 * rolled. This module exists because a hand-entered number has no terms.
 *
 * @module ws/handlers/initiativeRollRecord
 */

import type { DiceRoll } from "@herobyte/shared";

/** The d20 face range. A manual entry outside it is not a d20 result. */
const D20_MIN = 1;
const D20_MAX = 20;

export interface ManualInitiativeRecord {
  formula: string;
  total: number;
  breakdown: DiceRoll["breakdown"];
}

function isD20Face(value: number): boolean {
  return Number.isInteger(value) && value >= D20_MIN && value <= D20_MAX;
}

/**
 * Build the log line for a hand-entered initiative.
 *
 * `initiative` is the final number and `modifier` the character's bonus, so the
 * implied die face is the difference — that is exactly what the modal collects,
 * a 1-20 face which it adds the modifier to.
 *
 * Two shapes, and the choice between them is about not lying in the log:
 *
 *   - when the implied face IS a legal d20 result, the entry renders as a d20
 *     roll, because that is what happened: someone threw a d20 across the table
 *   - when it is not — a DM typing 47 for a monster, or a negative — the entry
 *     renders as a flat value with NO die. Claiming "d20 rolled 47" would make
 *     the log the one place at the table that is wrong about the dice
 *
 * `superseded` is the value being overridden, and it rides in `dropped` — the
 * same channel advantage uses for the throw it discarded, which the log already
 * renders struck through. It is only meaningful in the d20 shape: a struck-out
 * number next to a value that never claimed to be a die reads as noise.
 */
export function buildManualInitiativeRecord(
  initiative: number,
  modifier: number,
  superseded?: number,
): ManualInitiativeRecord {
  const face = initiative - modifier;

  if (!isD20Face(face)) {
    // No die claimed, so no dropped face either.
    return {
      formula: String(initiative),
      total: initiative,
      breakdown: [{ tokenId: "t0", subtotal: initiative }],
    };
  }

  const dieTerm: DiceRoll["breakdown"][number] = {
    tokenId: "t0",
    die: "d20",
    rolls: [face],
    subtotal: face,
  };

  if (superseded !== undefined && isD20Face(superseded)) {
    dieTerm.dropped = [superseded];
  }

  const breakdown: DiceRoll["breakdown"] = [dieTerm];
  if (modifier !== 0) {
    breakdown.push({ tokenId: "t1", subtotal: modifier });
  }

  return {
    // Rendered the same way rollTerms renders it, so the two paths produce one
    // shape in the log: a quantity of one is dropped, and the sign is explicit.
    formula: modifier === 0 ? "d20" : `d20 ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`,
    total: initiative,
    breakdown,
  };
}
