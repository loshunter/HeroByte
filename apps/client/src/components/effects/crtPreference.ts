// ============================================================================
// CRT PREFERENCE STORE
// ============================================================================
// CRT is a local display preference, never shared room state. Read storage once
// when this module loads, then keep the current value in memory so a blocked or
// full localStorage cannot break the toggle. Only a changed preference is written;
// merely opening the table must not create an entry for an untouched default.

const STORAGE_KEY = "herobyte:crt";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // Includes storage getters that throw in restricted browser contexts.
    return false;
  }
}

let enabled = readStored();
const listeners = new Set<() => void>();

export function getCrtPreference(): boolean {
  return enabled;
}

export function subscribeCrtPreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setCrtPreference(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The in-memory preference still works when persistence is unavailable.
  }
  listeners.forEach((listener) => listener());
}

/** Test-only: simulate a fresh page's initial read of storage. */
export function __resetCrtPreferenceForTests(): void {
  enabled = readStored();
  listeners.clear();
}
