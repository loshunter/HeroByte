/**
 * Where the DM's selection bar (MultiSelectToolbar) sits along its strip under the
 * header. It stays BELOW the floating windows (z 1000): raised above them, it covered
 * the ✕ of the windows that open under the header (NPC settings, ROLL RESULT, the dice
 * roller), and a click meant to close one locked or unlocked the selection instead
 * (3fd6c945). Below them, a window docked over the centre (Chat & Rolls at 1024 px)
 * covered 🔓 Unlock. So the bar steps aside: centred when nothing is in the way,
 * otherwise in the free gap nearest the centre, beside the windows that overlap its strip.
 */

export interface Span {
  left: number;
  right: number;
}

/** Space kept from the viewport's edges and from a window's edge. */
export const BAR_GAP = 8;

/** The narrowest gap the bar will wrap into (two rows) when no gap holds it on one. */
export const MIN_WRAPPED_WIDTH = 240;

export interface BarPlacement {
  left: number;
  /** Set when the bar wraps to fit a gap narrower than its one-row width. */
  maxWidth: number | null;
}

/**
 * Where the bar goes. `barWidth` is its one-row width; `obstacles` are the horizontal
 * spans of the open windows that overlap its strip. The bar takes the gap nearest the
 * centre that holds it on one row; failing that, it wraps into the widest gap at least
 * MIN_WRAPPED_WIDTH wide (at 922 px Chat & Rolls leaves 486 px, a little under one row);
 * failing that, it stays centred, as before (the window can be moved).
 */
export function selectionBarPlacement(
  barWidth: number,
  viewportWidth: number,
  obstacles: readonly Span[],
): BarPlacement {
  const centred = (viewportWidth - barWidth) / 2;
  const oneRow = selectionBarLeft(barWidth, viewportWidth, obstacles);
  if (oneRow !== null) return { left: oneRow, maxWidth: null };
  const widest = freeGaps(viewportWidth, obstacles).sort(
    (a, b) => b.right - b.left - (a.right - a.left),
  )[0];
  if (widest && widest.right - widest.left >= MIN_WRAPPED_WIDTH) {
    return { left: widest.left, maxWidth: widest.right - widest.left };
  }
  return { left: centred, maxWidth: null };
}

/** The free gaps between the viewport's edges and the windows (each kept BAR_GAP clear). */
function freeGaps(viewportWidth: number, obstacles: readonly Span[]): Span[] {
  const blocked = obstacles
    .map((span) => ({ left: span.left - BAR_GAP, right: span.right + BAR_GAP }))
    .sort((a, b) => a.left - b.left);
  const gaps: Span[] = [];
  let from = BAR_GAP;
  for (const span of blocked) {
    if (span.left > from) gaps.push({ left: from, right: span.left });
    from = Math.max(from, span.right);
  }
  if (viewportWidth - BAR_GAP > from) gaps.push({ left: from, right: viewportWidth - BAR_GAP });
  return gaps;
}

/**
 * The bar's left edge (px) on one row: centred when nothing is in the way, else in the
 * free gap nearest the centre that holds it; null when no gap does.
 */
export function selectionBarLeft(
  barWidth: number,
  viewportWidth: number,
  obstacles: readonly Span[],
): number | null {
  const centred = (viewportWidth - barWidth) / 2;
  const blocked = obstacles
    .map((span) => ({ left: span.left - BAR_GAP, right: span.right + BAR_GAP }))
    .sort((a, b) => a.left - b.left);
  const clear = (left: number) =>
    blocked.every((span) => left + barWidth <= span.left || left >= span.right);
  if (clear(centred)) return centred;

  let best: number | null = null;
  for (const gap of freeGaps(viewportWidth, obstacles)) {
    if (gap.right - gap.left < barWidth) continue;
    // The position inside this gap nearest the centre.
    const left = Math.min(Math.max(centred, gap.left), gap.right - barWidth);
    if (best === null || Math.abs(left - centred) < Math.abs(best - centred)) best = left;
  }
  return best;
}
