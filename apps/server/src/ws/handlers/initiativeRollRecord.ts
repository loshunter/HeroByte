/**
 * initiativeRollRecord
 *
 * Shapes the roll-log line for a HAND-ENTERED initiative — the case where a
 * player rolled physical dice at the table, the DM allowed it, and the number
 * is typed in. The table should see that as a result, not as a silent change.
 *
 * The rolled path does not come through here: it goes through
 * `DiceService.rollFor`, which builds its own breakdown from terms it actually
 * rolled. This module exists because a hand-entered number has no terms.
 *
 * @module ws/handlers/initiativeRollRecord
 */

import type { DiceRoll } from "@herobyte/shared";

export interface ManualInitiativeRecord {
  formula: string;
  total: number;
  breakdown: DiceRoll["breakdown"];
}

/**
 * Build the log line for a hand-entered initiative.
 *
 * `initiative` is the final number and `modifier` the character's bonus, so the
 * value the person actually read off the table is the difference.
 *
 * **This no longer claims a die.** It used to render as `d20 + 3` with the face
 * in `rolls`, on the reasoning that someone really had thrown a d20 — and for a
 * legal face that was true. But the log is read at a glance, and a row that
 * says `d20` is a row that says "the server rolled this", which is the one
 * thing a hand-entered number must never say. The owner's framing on
 * 2026-08-24 settles it: nobody is trying to pass a typed score off as a roll,
 * so the entry states a value and a modifier and nothing else. What it WAS is
 * carried by `handEntered` on the roll, which the log renders in its own colour
 * with a BY HAND badge.
 *
 * Dropping the die claim also removes the old 1-20 bounds check and the two
 * shapes it selected between: there is nothing left for a face of 47 to be
 * inconsistent with, so a DM typing a monster's flat initiative and a player
 * typing what they threw produce the same honest shape.
 *
 * The superseded value is NOT here. It rides on the roll as `supersededTotal`,
 * because it supersedes a whole result rather than a die within a term — see
 * the field's note on `DiceRoll`.
 */
export function buildManualInitiativeRecord(
  initiative: number,
  modifier: number,
): ManualInitiativeRecord {
  const entered = initiative - modifier;

  // No `die`, so the log renders the numbers themselves. One term when there is
  // no modifier, because "14 + 0" is noise.
  const breakdown: DiceRoll["breakdown"] = [{ tokenId: "t0", subtotal: entered }];
  if (modifier !== 0) {
    breakdown.push({ tokenId: "t1", subtotal: modifier });
  }

  return {
    formula:
      modifier === 0
        ? String(entered)
        : `${entered} ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`,
    total: initiative,
    breakdown,
  };
}
