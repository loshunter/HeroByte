// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================
// Centralized helpers for security-related environment configuration

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://herobyte.pages.dev",
];

function parseEnvList(value: string | undefined): string[] | null {
  if (!value) return null;
  const trimmed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the list of allowed origins for HTTP/WebSocket requests.
 * Accepts a comma-separated list via HEROBYTE_ALLOWED_ORIGINS.
 * Supports the wildcard "*" to disable origin checks (not recommended).
 */
export function getAllowedOrigins(): string[] {
  const envList = parseEnvList(process.env.HEROBYTE_ALLOWED_ORIGINS);
  if (envList) {
    if (envList.includes("*")) {
      return ["*"];
    }
    return Array.from(new Set(envList));
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Determine whether the provided origin is permitted.
 * Empty/undefined origins are treated as internal requests and allowed.
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) {
    return true;
  }
  const allowed = getAllowedOrigins();
  if (allowed.includes("*")) {
    return true;
  }
  return allowed.includes(origin);
}

/**
 * Return a comma-separated string of allowed origins for logging/documentation.
 */
export function formatAllowedOrigins(): string {
  const allowed = getAllowedOrigins();
  return allowed.includes("*") ? "*" : allowed.join(", ");
}
