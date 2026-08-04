// ============================================================================
// DICE DOMAIN — THE ROLLER
// ============================================================================
// The randomness lives here, on the server, with exactly one caller
// (DiceService.rollFor). That is the whole of S5: before it the client rolled
// and the server stored the answer, so a devtools console could post a 999
// under someone else's name (arc defect D2).
//
// It deliberately does NOT live in @herobyte/shared. A roller both halves can
// import is an invitation to roll on the client "just for the preview", and
// the second caller is the one that puts the bug back. Shared owns the
// notation (parseDiceFormula); the server owns the dice.

import { randomInt } from "node:crypto";
import { DIE_FACES, formatDiceTerms } from "@herobyte/shared";
import type { DiceRoll, DiceRollMode, DiceTerm } from "@herobyte/shared";

/**
 * A source of die faces: given a face count, return a value in [1, faces].
 *
 * Injectable for ONE reason — golden-seed determinism in tests. Production
 * always gets `cryptoDiceRng`; nothing on the wire can choose the generator.
 */
export type DiceRng = (faces: number) => number;

/**
 * `randomInt` rejection-samples internally, so there is no modulo bias to
 * hand-roll around (the client's old rngIntSecure did that work itself).
 */
export const cryptoDiceRng: DiceRng = (faces) => randomInt(1, faces + 1);

/** What a settled roll contributes to a DiceRoll record. */
export interface RolledFormula {
  /** Canonical notation, re-rendered from the parsed terms. */
  formula: string;
  total: number;
  /** The mode that ACTUALLY applied — "normal" when there was no die to double. */
  mode: DiceRollMode;
  breakdown: DiceRoll["breakdown"];
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function rollSet(qty: number, faces: number, rng: DiceRng): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < qty; i++) rolls.push(rng(faces));
  return rolls;
}

/**
 * Roll parsed terms and return the settled result.
 *
 * ADVANTAGE applies to the FIRST die term only — for "d20 + 5" that is the
 * d20, which is what the rule means. The term is rolled a second time at full
 * quantity and the better (or worse) SUBTOTAL wins; the loser is kept in
 * `dropped` so the log can show what was given up. A tie keeps the first set,
 * so the same seed always produces the same answer.
 *
 * A formula with no dice at all ("+5") reports mode "normal": claiming
 * advantage over nothing would put an ADV badge on a roll where nothing was
 * doubled.
 *
 * `rolls` always holds raw faces; the term's sign rides on `subtotal`. Crit
 * detection on the client reads faces, so "1d20 - 1d4" still lights up a
 * natural 20.
 */
export function rollTerms(
  terms: DiceTerm[],
  requestedMode: DiceRollMode = "normal",
  rng: DiceRng = cryptoDiceRng,
): RolledFormula {
  const advantageIndex = terms.findIndex((term) => term.kind === "die");
  const mode: DiceRollMode = advantageIndex === -1 ? "normal" : requestedMode;

  const breakdown: DiceRoll["breakdown"] = [];
  let total = 0;

  terms.forEach((term, index) => {
    // Positional ids: the client renders the breakdown in formula order and
    // needs a stable React key, nothing more. Minting them here (rather than
    // echoing a client's token ids) keeps the record entirely the server's.
    const tokenId = `t${index}`;

    if (term.kind === "mod") {
      breakdown.push({ tokenId, subtotal: term.value });
      total += term.value;
      return;
    }

    const faces = DIE_FACES[term.die];
    const first = rollSet(term.qty, faces, rng);
    let kept = first;
    let dropped: number[] | undefined;

    if (mode !== "normal" && index === advantageIndex) {
      const second = rollSet(term.qty, faces, rng);
      // Compare what each throw CONTRIBUTES, not its raw faces. On a
      // subtracted term ("-1d20 + 50") the higher faces make the total lower,
      // so comparing raw sums would quietly turn advantage into
      // disadvantage — the mode would be recorded and badged as the opposite
      // of what it did. Advantage always maximises the total.
      const contribution = (rolls: number[]) => term.sign * sum(rolls);
      const takeSecond =
        mode === "advantage"
          ? contribution(second) > contribution(first)
          : contribution(second) < contribution(first);
      kept = takeSecond ? second : first;
      dropped = takeSecond ? first : second;
    }

    const subtotal = term.sign * sum(kept);
    total += subtotal;
    breakdown.push(
      dropped
        ? { tokenId, die: term.die, rolls: kept, dropped, subtotal }
        : { tokenId, die: term.die, rolls: kept, subtotal },
    );
  });

  return { formula: formatDiceTerms(terms), total, mode, breakdown };
}
