// ============================================================================
// PANEL PRESENCE
// ============================================================================
// A count of how many floating panels are currently open, published onto
// <html> as `data-panels-open` so CSS alone can react to it.
//
// WHY: the CRT filter is a fixed, full-screen overlay — scanlines, a phosphor
// bloom and chromatic aberration painted above everything at z-index 9998+.
// Over the map that IS the product. Over a settings panel it lands on small
// form text and error messages and makes them genuinely hard to read. The
// owner's call was that the filter may soften while a panel is open and
// restore over the map, so panels need to announce themselves.
//
// A COUNTER, not a boolean: panels stack (the DM menu with a settings window
// over it), and a boolean would clear on the first close while one was still
// open.

const ATTRIBUTE = "data-panels-open";

let openCount = 0;

function publish(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (openCount > 0) {
    root.setAttribute(ATTRIBUTE, String(openCount));
  } else {
    root.removeAttribute(ATTRIBUTE);
  }
}

/**
 * Register an open panel. Returns the matching release function — call it on
 * unmount. Releasing twice is a no-op, so a double-invoked cleanup (React
 * strict mode) cannot drive the count negative.
 */
export function registerOpenPanel(): () => void {
  openCount += 1;
  publish();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    publish();
  };
}

/** How many panels are currently registered. Exposed for tests. */
export function openPanelCount(): number {
  return openCount;
}

/** Drop all registrations. Test-only — nothing in the app should need this. */
export function resetPanelPresence(): void {
  openCount = 0;
  publish();
}
