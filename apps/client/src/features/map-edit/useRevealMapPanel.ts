import { useLayoutEffect, useRef } from "react";

/** Opening a disclosure reveals its first controls without moving the pinned bars. */
export function useRevealMapPanel(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    const scroller = panel?.closest<HTMLElement>(".map-edit-palette__scroll");
    if (!open || !panel || !scroller) return;
    scroller.scrollTop += panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  }, [open]);
  return ref;
}
