// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================
// Centralized helpers for security-related environment configuration

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://herobyte.pages.dev",
];

/**
 * Is this origin a machine on the local network (or the loopback)?
 *
 * Used only to let a phone on the same Wi-Fi reach the dev server — see
 * isLanDevAccessEnabled below for why that cannot reach production.
 */
export function isPrivateLanOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || host === "::1") return true;
  // mDNS names a phone may resolve, e.g. http://my-laptop.local:5174
  if (host.endsWith(".local")) return true;

  const octets = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!octets) return false;

  const [a, b, c, d] = octets.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;

  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 169 && b === 254) return true; // link-local

  return false;
}

/**
 * Whether to accept any private-LAN origin.
 *
 * Deliberately NOT keyed off `NODE_ENV !== "production"`. The server never
 * reads NODE_ENV anywhere else, and setting it on Render is a documented
 * checklist item rather than something the code enforces — so a missed
 * checkbox would silently widen the real deployment. Instead `pnpm dev` sets
 * HEROBYTE_DEV_ALLOW_LAN itself, which production cannot do because it runs
 * `node dist/index.js`. NODE_ENV is then checked as a second latch, so even if
 * the flag somehow leaked into a production environment it stays inert.
 */
function isLanDevAccessEnabled(): boolean {
  return process.env.HEROBYTE_DEV_ALLOW_LAN === "true" && process.env.NODE_ENV !== "production";
}

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
  if (allowed.includes(origin)) {
    return true;
  }
  // Dev only: a phone on the same Wi-Fi hits http://192.168.x.x:5174, which no
  // fixed allowlist can predict.
  return isLanDevAccessEnabled() && isPrivateLanOrigin(origin);
}

/**
 * Return a comma-separated string of allowed origins for logging/documentation.
 */
export function formatAllowedOrigins(): string {
  const allowed = getAllowedOrigins();
  if (allowed.includes("*")) return "*";
  const base = allowed.join(", ");
  return isLanDevAccessEnabled() ? `${base} (+ any private LAN address, dev only)` : base;
}
