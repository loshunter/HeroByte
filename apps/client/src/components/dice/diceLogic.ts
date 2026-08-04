// ============================================================================
// DICE LOGIC — the build/formula bridge
// ============================================================================
// This file used to hold the RNG: `rngIntSecure` and `rollBuild` produced the
// numbers, and the server stored them (arc defect D2). Both are gone. The
// client's only job now is to say what it wants rolled; the roller lives in
// apps/server/src/domains/dice/roller.ts and has one caller.
//
// What remains is the translation between the build strip's token array and
// the notation the server's parser reads — and it goes through the SHARED
// formatter, so the string this produces is by construction one that
// parseDiceFormula accepts.

import { formatDiceTerms, type DiceTerm } from "@herobyte/shared";
import type { Build, RollResult } from "./types";

/**
 * Render the build strip's tokens as dice notation, e.g. "2d20 + 5 - 1".
 *
 * Quantities are clamped to at least 1: the strip's stepper can reach zero,
 * and "0d6" is a formula the server refuses — better to send the roll the
 * player obviously meant than to fail the request on a UI edge.
 */
export function formulaFromBuild(build: Build): string {
  const terms: DiceTerm[] = build.map((token) =>
    token.kind === "die"
      ? { kind: "die", die: token.die, qty: Math.max(1, Math.floor(token.qty)), sign: 1 }
      : { kind: "mod", value: Math.trunc(token.value) },
  );
  return formatDiceTerms(terms);
}

/**
 * Format a settled roll as copyable text.
 * Example: "2d20 + 5 → 26"
 */
export function formatRollText(result: RollResult): string {
  return `${result.formula} → ${result.total}`;
}
