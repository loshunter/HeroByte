// ============================================================================
// AUTH CONFIGURATION
// ============================================================================
// Centralizes access to authentication-related environment variables

const DEFAULT_ROOM_ID = "default";
const DEV_FALLBACK_SECRET = "herobyte-dev";

let warnedAboutFallback = false;

/**
 * Retrieve the shared room secret from environment configuration.
 * Falls back to a development secret if not provided.
 */
export function getRoomSecret(): string {
  const envSecret = process.env.HEROBYTE_ROOM_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }

  if (!warnedAboutFallback) {
    console.warn(
      "[Auth] HEROBYTE_ROOM_SECRET not set; using development fallback secret. Set the env var in production.",
    );
    warnedAboutFallback = true;
  }

  return DEV_FALLBACK_SECRET;
}

/**
 * Retrieve the default room identifier. Placeholder for future multi-room support.
 */
export function getDefaultRoomId(): string {
  return process.env.HEROBYTE_DEFAULT_ROOM_ID?.trim() || DEFAULT_ROOM_ID;
}
