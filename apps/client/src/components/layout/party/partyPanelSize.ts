// ============================================================================
// PARTY PANEL SIZE — how the map learns the Party panel changed height
// ============================================================================
// The Party panel changes height by itself (roster or cards, details open or
// closed, hidden or shown — U7), and the map's bottom edge is set from that
// height (App's `bottomHeight`). It must NOT announce the change as a window
// `resize` (the old panel did, but only on hide and show): every resize
// cancels an in-flight map gesture and pending focus returns
// (useToolContextTransitions), so a remote player's HP edit that re-wrapped a
// row would cancel the DM's brush stroke. It announces this named event
// instead, and App re-measures on it.

export const PARTY_PANEL_RESIZED = "herobyte:party-panel-resized";

/** Observe the panel's own box; returns the cleanup. */
export function announcePartyPanelSize(node: HTMLElement): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};
  const observer = new ResizeObserver(() => {
    window.dispatchEvent(new Event(PARTY_PANEL_RESIZED));
  });
  observer.observe(node);
  return () => observer.disconnect();
}
