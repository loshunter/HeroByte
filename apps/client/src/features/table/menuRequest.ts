// ============================================================================
// DM MENU REQUESTS
// ============================================================================
// "Table settings…" lives in the Table menu (everyone's) but opens a tab of the
// DM menu, whose open/tab state is local to the lazy DM chunk. This is the one
// seam between them: a request the menu takes when it is there to take it.
//
// A request is for NOW. One nobody took — the viewer is not a DM, the chunk is
// still loading — expires, so a later mount of the menu never opens itself at
// a tab somebody asked for minutes ago. Ten seconds: long enough for the lazy
// chunk to arrive over a slow phone connection (the request is the whole point
// of the click), short enough that it is never "a while ago".

import type { DMMenuTab } from "../dm/hooks/useDMMenuState";

const REQUEST_LIFETIME_MS = 10_000;

let pending: { tab: DMMenuTab; at: number } | null = null;
const listeners = new Set<() => void>();

/** Ask the DM menu to open on `tab` (a no-op for anyone without the menu). */
export function requestDMMenuTab(tab: DMMenuTab, now: number = Date.now()): void {
  pending = { tab, at: now };
  listeners.forEach((listener) => listener());
}

/** Take the live request, once: the menu calls this on mount and when told of a new one. */
export function takeDMMenuTabRequest(now: number = Date.now()): DMMenuTab | null {
  const request = pending;
  pending = null;
  if (!request || now - request.at > REQUEST_LIFETIME_MS) return null;
  return request.tab;
}

export function subscribeDMMenuRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: forget any request and every subscriber. */
export function __resetDMMenuRequestsForTests(): void {
  pending = null;
  listeners.clear();
}
