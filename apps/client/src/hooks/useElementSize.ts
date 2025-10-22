import { useEffect, useRef, useState } from "react";

/**
 * Hook to track the size of a DOM element.
 * Updates whenever the element is resized using ResizeObserver.
 *
 * @returns Object containing:
 *   - ref: React ref to attach to the element
 *   - w: Current width of the element
 *   - h: Current height of the element
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ref, w, h } = useElementSize<HTMLDivElement>();
 *   return <div ref={ref}>Size: {w}x{h}</div>;
 * }
 * ```
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return { ref, ...size };
}
