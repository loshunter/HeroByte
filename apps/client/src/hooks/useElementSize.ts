import { useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks the size of a DOM element. First paint uses the element's real
 * measured rect (read in a layout effect, before the browser paints) rather than
 * a magic default — so the canvas fills its container immediately with no
 * wrong-size flash. Thereafter a ResizeObserver keeps it in sync, and a
 * window resize / orientationchange fallback re-fits on rotation and catches the
 * cases an observer can miss (rAF-debounced).
 *
 * @returns `{ ref, w, h }` — attach `ref` to the element you want measured.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const frameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = (w: number, h: number) => {
      // Ignore a 0×0 read (parent not laid out yet) so we don't clobber a good
      // size; the observer's first callback delivers it once layout settles.
      if (w <= 0 && h <= 0) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    const readRect = () => {
      const rect = el.getBoundingClientRect();
      apply(rect.width, rect.height);
    };
    const scheduleRead = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        readRect();
      });
    };

    readRect(); // correct first paint — this runs before the browser paints

    const observer = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) apply(cr.width, cr.height);
    });
    observer.observe(el);
    window.addEventListener("resize", scheduleRead);
    window.addEventListener("orientationchange", scheduleRead);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleRead);
      window.removeEventListener("orientationchange", scheduleRead);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return { ref, ...size };
}
