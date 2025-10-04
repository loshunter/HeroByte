// ============================================================================
// SESSION UTILITIES
// ============================================================================
// Session management and persistence helpers

import { generateUUID } from "./uuid";

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
