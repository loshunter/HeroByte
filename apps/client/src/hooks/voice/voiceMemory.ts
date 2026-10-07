// ============================================================================
// VOICE MEMORY
// ============================================================================
// Whether this tab was in the table's voice call, so a RELOAD rejoins it in the
// same state. Per tab (sessionStorage, like the table password) and per table
// (the ?room= link), so opening another table never joins its call by itself.
//
// Only a reload: browsers restore sessionStorage with restored tabs (reopening a
// closed tab, "continue where you left off"), and a mic that switched itself on
// hours later, unasked, would be a privacy failure. So the memory carries when it
// was last true (refreshed as the page goes away) and is honoured for a minute.
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

export function recallVoice(): Remembered | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key()) ?? "null");
    if (!value || typeof value !== "object") return null;
    const { state, at } = value as { state?: unknown; at?: unknown };
    if (state !== "live" && state !== "muted") return null;
    if (typeof at !== "number" || Date.now() - at > RELOAD_WINDOW_MS) return null;
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
