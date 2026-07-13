// ============================================================================
// AUTH CONFIGURATION
// ============================================================================
// Centralizes access to authentication-related environment variables

const DEFAULT_ROOM_ID = "default";
const DEV_FALLBACK_SECRET = "Fun1";
const DEV_FALLBACK_DM_PASSWORD = "FunDM";
const DEFAULT_MAX_CUSTOM_ROOMS = 500;

let warnedAboutFallback = false;
let warnedAboutDMFallback = false;

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
 * Retrieve the DM password from environment configuration.
 * Falls back to a development password if not provided.
 */
export function getDMPassword(): string {
  const envDMPassword = process.env.HEROBYTE_DM_PASSWORD?.trim();
  if (envDMPassword) {
    return envDMPassword;
  }

  if (!warnedAboutDMFallback) {
    console.warn(
      "[Auth] HEROBYTE_DM_PASSWORD not set; using development fallback DM password. Set the env var in production.",
    );
    warnedAboutDMFallback = true;
  }

  return DEV_FALLBACK_DM_PASSWORD;
}

/**
 * Retrieve the default room identifier. Placeholder for future multi-room support.
 */
export function getDefaultRoomId(): string {
  return process.env.HEROBYTE_DEFAULT_ROOM_ID?.trim() || DEFAULT_ROOM_ID;
}

/**
 * The maximum number of custom (private) rooms the server will mint. create-room
 * runs BEFORE authentication (you can't be in a room that doesn't exist yet), so
 * without a ceiling an anonymous client could stream unique roomIds and grow the
 * in-memory + on-disk secret store without bound, each create also running
 * blocking scrypt. This bounds that persisted state; override with
 * HEROBYTE_MAX_CUSTOM_ROOMS for larger deployments.
 */
export function getMaxCustomRooms(): number {
  const parsed = Number(process.env.HEROBYTE_MAX_CUSTOM_ROOMS?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_CUSTOM_ROOMS;
}

/**
 * Whether the server is explicitly running in demo mode.
 *
 * Demo mode opts in to convenience behaviors that are unsafe for real
 * deployments — currently, rendering the fallback room password in plaintext
 * on the HTTP landing page. It must be enabled explicitly via
 * HEROBYTE_DEMO_MODE=true; an unconfigured server no longer exposes its
 * fallback password to anonymous HTTP visitors.
 */
export function isDemoMode(): boolean {
  return process.env.HEROBYTE_DEMO_MODE?.trim().toLowerCase() === "true";
}
