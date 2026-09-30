// ============================================================================
// HEADER PLACEMENT — where an un-placed floating window sits
// ============================================================================

import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * Where a window with no remembered place opens: its own `y`, or just under the header's
 * lowest control, whichever is lower. The header's height is not fixed (its tools wrap; it
 * carries the public-table row; a DM has more of them), and a flat 100px sat under the tools
 * on a short header and ON them on a tall one, covering the button that would close it.
 * Measured from the controls, not the frame, so a palette that was never in the way stays put.
 */
export function belowHeader(y: number): number {
  const controls = document.querySelectorAll<HTMLElement>("[data-header-root] button");
  let lowest = 0;
  for (const control of controls) {
    const box = control.getBoundingClientRect();
    if (box.height > 0) lowest = Math.max(lowest, box.bottom);
  }
  return lowest === 0 ? y : Math.max(y, Math.ceil(lowest) + 4);
}

/**
 * The header's height changes while a window is open: a player who enters DM mode gains
 * Build map and Player View, the tools wrap a row lower, and a window opened a moment
 * earlier would lie over the buttons that moved. So an un-placed window follows the header
 * (`placed` is true once it has a remembered place or the player has taken hold of it).
 */
export function useFollowHeader(
  enabled: boolean,
  baseY: number,
  placed: MutableRefObject<boolean>,
  move: (y: number) => void,
): void {
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") return;
    const header = document.querySelector("[data-header-root]");
    if (!header) return;
    const observer = new ResizeObserver(() => {
      if (!placed.current) moveRef.current(belowHeader(baseY));
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [enabled, baseY, placed]);
}
