// ============================================================================
// SESSION UTILITIES
// ============================================================================
// Session management and persistence helpers

const SESSION_UID_KEY = "herobyte-session-uid";

/**
 * Get or create a unique session ID for this browser
 * Stored in localStorage to persist across page reloads
 */
export function getSessionUID(): string {
  const existing = localStorage.getItem(SESSION_UID_KEY);
  if (existing) return existing;

  const uid = generateUUID();
  localStorage.setItem(SESSION_UID_KEY, uid);
  return uid;
}

/**
 * Clear the stored session UID (useful for testing or logout)
 */
export function clearSessionUID(): void {
  localStorage.removeItem(SESSION_UID_KEY);
}

/**
 * Generate a UUID v4
 * Uses crypto.randomUUID() if available, otherwise falls back to a polyfill
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
