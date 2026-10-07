// ============================================================================
// VOICE MEMORY
// ============================================================================
// Whether this tab was in the table's voice call, so a RELOAD rejoins it in the
// same state. Per tab (sessionStorage, like the table password) and per table
// (the ?room= link), so opening another table never joins its call by itself.
//
// Only a reload: browsers restore sessionStorage with restored tabs (reopening a
// closed tab, Back into it, "continue where you left off"), and a mic that
// switched itself on after the player closed the tab to leave would be a privacy
// failure. So the memory is honoured only when this page load IS a reload, and
// within a minute of when it was last true (refreshed as the page goes away).
// Storage can be missing or refuse (private windows): voice then simply does not
// come back after a reload.

type Remembered = "live" | "muted";

/** How long after the page went away a load still counts as a reload. */
export const RELOAD_WINDOW_MS = 60_000;

function key(): string {
  const room = new URLSearchParams(window.location.search).get("room")?.trim() || "default";
  return `herobyte.voice:${room}`;
}

export function rememberVoice(state: Remembered): void {
  try {
    window.sessionStorage.setItem(key(), JSON.stringify({ state, at: Date.now() }));
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

/** True only when this page load is a reload (not a reopened, restored or new tab). */
function isReload(): boolean {
  const entry = window.performance?.getEntriesByType?.("navigation")[0];
  return (entry as PerformanceNavigationTiming | undefined)?.type === "reload";
}

export function recallVoice(): Remembered | null {
  try {
    if (!isReload()) return null;
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key()) ?? "null");
    if (!value || typeof value !== "object") return null;
    const { state, at } = value as { state?: unknown; at?: unknown };
    if (state !== "live" && state !== "muted") return null;
    if (typeof at !== "number") return null;
    const age = Date.now() - at;
    if (age < 0 || age > RELOAD_WINDOW_MS) return null;
    return state;
  } catch {
    return null;
  }
}

export function forgetVoice(): void {
  try {
    window.sessionStorage.removeItem(key());
  } catch {
    // Nothing to forget.
  }
}
