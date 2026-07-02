// ============================================================================
// DICE JUICE
// ============================================================================
// Detects natural 20s / natural 1s in a roll result so the UI can celebrate a
// crit or mourn a fumble. A "crit" is any d20 that landed on 20; a "fumble" is
// any d20 that landed on 1. When both occur in one multi-d20 roll, crit wins.

import type { RollResult } from "../../components/dice/types";

export type RollFlavor = "crit" | "fumble" | "normal";

export function detectRollFlavor(result: RollResult | null | undefined): RollFlavor {
  if (!result) return "normal";

  let sawCrit = false;
  let sawFumble = false;

  for (const entry of result.perDie) {
    if (entry.die !== "d20" || !entry.rolls) continue;
    for (const face of entry.rolls) {
      if (face === 20) sawCrit = true;
      else if (face === 1) sawFumble = true;
    }
  }

  if (sawCrit) return "crit";
  if (sawFumble) return "fumble";
  return "normal";
}
