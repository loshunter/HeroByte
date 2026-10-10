// ============================================================================
// READABLE COLOURS — a random colour for a token nobody picked a colour for
// ============================================================================
// The colour window runs from deep shades to pastels for players to PICK
// (colorWindow.ts). A colour drawn at random (an NPC's, the DM's double-click
// recolour of their own token) has no picker behind it to fix an unreadable one,
// so it comes from the part of the window that reads on a dark map.

import { colorToOkLab, contrastRatio, deltaE, normalizeColor, parseColor } from "./colorSpace.js";
import { COLOR_RULE } from "./colorRule.js";
import { windowCells } from "./colorWindow.js";

/** A dark map floor (the picker preview's): a colour nobody picked must still read on it. */
const DARK_FLOOR = "#2a2622";
let readableIndices: number[] | null = null;

/** Window cells at least 3:1 on a dark map floor (the window's lighter rows, about L 0.57 up). */
function readableCells(): number[] {
  if (!readableIndices) {
    // Parsed here, not at module load: a top-level call would keep this module (and the
    // colour window) in every bundle that imports the shared barrel.
    const floor = parseColor(DARK_FLOOR)!;
    readableIndices = [];
    windowCells().forEach((cell, index) => {
      if (contrastRatio(parseColor(cell.hex)!, floor) >= 3) readableIndices!.push(index);
    });
  }
  return readableIndices;
}

/**
 * A random colour for a token nobody picked a colour for (an NPC, or the DM's
 * double-click recolour of their own token): drawn from the cells that read on a
 * dark map, at least `step` from `current` when one is given. The window runs to
 * deep shades for players to PICK; a drawn colour has no picker behind it to fix
 * an unreadable one.
 */
export function readableColor(
  rng: () => number,
  current?: string,
  step: number = COLOR_RULE.recolorStepMin,
): string {
  const cells = windowCells();
  const pool = readableCells();
  const stored = current ? normalizeColor(current) : null;
  const from = stored ? colorToOkLab(stored) : null;
  const moved = from ? pool.filter((index) => deltaE(cells[index]!.lab, from) >= step) : pool;
  const choices = moved.length > 0 ? moved : pool;
  return cells[choices[Math.floor(rng() * choices.length)]!]!.hex;
}
