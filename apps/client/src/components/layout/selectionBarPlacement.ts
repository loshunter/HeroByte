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

/**
 * The bar's left edge (px). `obstacles` are the horizontal spans of the open windows
 * that overlap the bar's strip vertically. With no gap wide enough, the bar stays
 * centred (a covered bar is no worse than before, and the window can be moved).
 */
export function selectionBarLeft(
  barWidth: number,
  viewportWidth: number,
  obstacles: readonly Span[],
): number {
  const centred = (viewportWidth - barWidth) / 2;
  const blocked = obstacles
    .map((span) => ({ left: span.left - BAR_GAP, right: span.right + BAR_GAP }))
    .sort((a, b) => a.left - b.left);
  const clear = (left: number) =>
    blocked.every((span) => left + barWidth <= span.left || left >= span.right);
  if (clear(centred)) return centred;

  // The free gaps between the viewport's edges and the windows, merged where they overlap.
  const gaps: Span[] = [];
  let from = BAR_GAP;
  for (const span of blocked) {
    if (span.left > from) gaps.push({ left: from, right: span.left });
    from = Math.max(from, span.right);
  }
  if (viewportWidth - BAR_GAP > from) gaps.push({ left: from, right: viewportWidth - BAR_GAP });

  let best: number | null = null;
  for (const gap of gaps) {
    if (gap.right - gap.left < barWidth) continue;
    // The position inside this gap nearest the centre.
    const left = Math.min(Math.max(centred, gap.left), gap.right - barWidth);
    if (best === null || Math.abs(left - centred) < Math.abs(best - centred)) best = left;
  }
  return best ?? centred;
}
