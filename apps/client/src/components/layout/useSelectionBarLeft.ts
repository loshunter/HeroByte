import { useLayoutEffect, useState, type RefObject } from "react";
import { selectionBarLeft, type Span } from "./selectionBarPlacement";

/** Marks what the selection bar steps around: a floating window (DraggableWindow), the toasts. */
export const FLOATING_WINDOW_ATTR = "data-floating-window";

/**
 * The selection bar's left edge in px, or null while nothing is in its way (CSS keeps
 * it centred, whatever its width). Re-placed when a window opens, closes or moves, when
 * the bar's own text changes its width (a DOM change, one per frame at most), and when
 * the viewport resizes.
 */
export function useSelectionBarLeft(bar: RefObject<HTMLElement>, active: boolean): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const el = bar.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const obstacles: Span[] = [];
      document.querySelectorAll(`[${FLOATING_WINDOW_ATTR}]`).forEach((win) => {
        const box = win.getBoundingClientRect();
        // Only a window that overlaps the bar's strip is in its way.
        if (box.width === 0 || box.bottom <= rect.top || box.top >= rect.bottom) return;
        obstacles.push({ left: box.left, right: box.right });
      });
      const centred = (window.innerWidth - rect.width) / 2;
      const placed = selectionBarLeft(rect.width, window.innerWidth, obstacles);
      const next = Math.abs(placed - centred) < 0.5 ? null : placed;
      setLeft((previous) =>
        previous === next || (previous !== null && next !== null && Math.abs(previous - next) < 0.5)
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
  return left;
}
