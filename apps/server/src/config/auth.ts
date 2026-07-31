// ============================================================================
// AUTH CONFIGURATION
// ============================================================================
// Centralizes access to authentication-related environment variables

const DEFAULT_ROOM_ID = "default";
const DEV_FALLBACK_SECRET = "Fun1";
const DEV_FALLBACK_DM_PASSWORD = "FunDM";
const DEFAULT_MAX_CUSTOM_ROOMS = 500;
const DEFAULT_ROOM_CLEAR_HOURS = 6;

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
 * How long the default table may sit empty before the server wipes it, in ms.
 *
 * The default table is public on any deployment that keeps the documented
 * fallback password, so it is cleared to stop it silting up (and filling its
 * asset quota). But a self-hoster whose server is private may legitimately run
 * their whole campaign in it — for them the wipe would be data loss, so
 * `HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS=0` turns it off entirely.
 */
export function getDefaultRoomClearMs(): number {
  const raw = process.env.HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS?.trim();
  const parsed = Number(raw);
  const hours =
    raw !== undefined && raw !== "" && Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_ROOM_CLEAR_HOURS;
  return hours * 60 * 60 * 1000;
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
