// ============================================================================
// WINDOW POSITION — where a floating window was last left
// ============================================================================
// Kept per window in localStorage, under a key of the window's own choosing. Storage can be
// missing or throw (private windows, blocked site data), and a remembered place can be stale
// (a smaller screen, a hand-edited value), so every read and write is guarded and a place that
// would leave the window off the screen is pulled back onto it.

const POSITION_KEY_PREFIX = "herobyte-window-position-";

export interface WindowPosition {
  x: number;
  y: number;
}

function getWindowStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    if (
      !storage ||
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function"
    ) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

/** The furthest a window's top-left may sit and still leave 200px across and 100px down on screen. */
function clampToViewport(position: WindowPosition): WindowPosition {
  const maxX = window.innerWidth - 200;
  const maxY = window.innerHeight - 100;
  return {
    x: Math.max(0, Math.min(position.x, maxX)),
    y: Math.max(0, Math.min(position.y, maxY)),
  };
}

/** The place this window was last left, pulled back onto the screen — or null if it has none. */
export function loadWindowPosition(storageKey: string): WindowPosition | null {
  const storage = getWindowStorage();
  if (!storage) return null;
  try {
    const saved = storage.getItem(`${POSITION_KEY_PREFIX}${storageKey}`);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return clampToViewport(parsed);
  } catch (error) {
    console.warn("Failed to load window position from localStorage:", error);
    return null;
  }
}

/** Remember where this window was left. `failure` is what is logged if the write is refused. */
export function saveWindowPosition(
  storageKey: string,
  position: WindowPosition,
  failure = "Failed to save window position to localStorage:",
): void {
  const storage = getWindowStorage();
  if (!storage) return;
  try {
    storage.setItem(`${POSITION_KEY_PREFIX}${storageKey}`, JSON.stringify(position));
  } catch (error) {
    console.warn(failure, error);
  }
}
