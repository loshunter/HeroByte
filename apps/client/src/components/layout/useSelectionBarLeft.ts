import { useLayoutEffect, useState, type RefObject } from "react";
import { selectionBarPlacement, type BarPlacement, type Span } from "./selectionBarPlacement";

/** Marks what the selection bar steps around: a floating window (DraggableWindow), the toasts. */
export const FLOATING_WINDOW_ATTR = "data-floating-window";

/**
 * Where the selection bar goes (its left edge, and a width to wrap to when only a narrow
 * gap is free), or null while nothing is in its way (CSS keeps it centred). Re-placed when a window opens, closes or moves, when
 * the bar's own text changes its width (a DOM change, one per frame at most), and when
 * the viewport resizes.
 */
export function useSelectionBarLeft(
  bar: RefObject<HTMLElement>,
  active: boolean,
): BarPlacement | null {
  const [placement, setPlacement] = useState<BarPlacement | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    let frame = 0;
    // Its one-row width, measured while it is not wrapped (wrapped, it measures the gap).
    let oneRow = 0;
    const place = () => {
      frame = 0;
      const el = bar.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (!el.style.maxWidth) oneRow = rect.width;
      const width = oneRow || rect.width;
      const obstacles: Span[] = [];
      document.querySelectorAll(`[${FLOATING_WINDOW_ATTR}]`).forEach((win) => {
        const box = win.getBoundingClientRect();
        // Only a window that overlaps the bar's strip is in its way.
        if (box.width === 0 || box.bottom <= rect.top || box.top >= rect.bottom) return;
        obstacles.push({ left: box.left, right: box.right });
      });
      const centred = (window.innerWidth - width) / 2;
      const placed = selectionBarPlacement(width, window.innerWidth, obstacles);
      const next =
        placed.maxWidth === null && Math.abs(placed.left - centred) < 0.5 ? null : placed;
      setPlacement((previous) =>
        previous === next ||
        (previous !== null &&
          next !== null &&
          Math.abs(previous.left - next.left) < 0.5 &&
          previous.maxWidth === next.maxWidth)
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    window.addEventListener("resize", schedule);
    // The bar's own width can change with no DOM change (a web font arriving late).
    const sized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (bar.current) sized?.observe(bar.current);
    return () => {
      observer.disconnect();
      sized?.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [bar, active]);
  return placement;
}
