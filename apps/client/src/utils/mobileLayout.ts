// ============================================================================
// MOBILE LAYOUT PREDICATE — one answer to "which layout is on screen"
// ============================================================================
// App.tsx chooses between MobileLayout and MainLayout with the rule below.
// DraggableWindow used to answer the same question with its own `innerWidth <
// 768`, and the two disagreed on real devices: a 812x375 landscape phone and a
// 1024x768 tablet both render MobileLayout, while both are wider than 768, so
// the roll log came up as a DESKTOP window inside the phone shell — draggable,
// positioned from a stored desktop coordinate, and with a 24px close button.
//
// The disagreement ran the other way too: a desktop browser narrowed to 750px
// kept MainLayout while DraggableWindow went full-screen mobile over it.
//
// So the rule lives here and both callers read it. This is a snapshot of the
// current window, not a hook: App.tsx already owns the resize/orientation
// listeners, and DraggableWindow already re-evaluates on resize.

/**
 * The media query half of the rule. Coarse pointers get the touch layout well
 * past phone width, because a tablet is a touch device with a big screen.
 */
export const MOBILE_LAYOUT_QUERY = "(max-width: 700px), (pointer: coarse) and (max-width: 1024px)";

/**
 * `?mobile=true` / `?mobile=false` force the layout, which is how the e2e
 * mobile project pins its choice rather than depending on a device descriptor.
 * Returns null when the parameter is absent or not one of those two values.
 */
function forcedLayout(): boolean | null {
  const mobileParam = new URLSearchParams(window.location.search).get("mobile");
  if (mobileParam === "true") return true;
  if (mobileParam === "false") return false;
  return null;
}

/** Is the mobile layout the one on screen right now? */
export function isMobileLayout(): boolean {
  const forced = forcedLayout();
  if (forced !== null) return forced;

  const query =
    typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_LAYOUT_QUERY) : null;
  // A short viewport is the landscape-phone case: wide enough to miss every
  // width test above, too short to hold the desktop chrome.
  const shortViewport = window.innerHeight <= 520 && window.innerWidth <= 900;
  return Boolean(query?.matches) || window.innerWidth <= 700 || shortViewport;
}

/**
 * True while the layout choice is pinned by the URL, so a caller can skip
 * subscribing to resize events that cannot change the answer.
 */
export function isLayoutForced(): boolean {
  return forcedLayout() !== null;
}
