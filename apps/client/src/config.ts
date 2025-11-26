// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================
// Environment-aware configuration for the client application

/**
 * WebSocket server URL
 * - Production (Cloudflare Pages): Uses VITE_WS_URL from environment
 * - Development: Smart hostname detection (ws://[current-host]:8787)
 * - URL Override: Add ?ws=ws://IP:PORT to URL to override
 *
 * Smart hostname detection allows:
 * - Desktop: http://localhost:5173 → ws://localhost:8787
 * - Laptop: http://192.168.50.226:5173 → ws://192.168.50.226:8787
 */
const urlParams = new URLSearchParams(window.location.search);
const wsOverride = urlParams.get("ws");

// Determine WebSocket URL
let computedWsUrl: string;

if (wsOverride) {
  // URL parameter takes highest priority
  computedWsUrl = wsOverride;
} else if (import.meta.env.VITE_WS_URL) {
  // Environment variable second priority
  computedWsUrl = import.meta.env.VITE_WS_URL;
} else {
  // Fallback: Auto-detect WebSocket URL from current hostname
  // Production will always use the secure wss:// protocol to avoid handshake 3xx errors
  // Development will use ws://localhost:8787
  const wsHost = import.meta.env.DEV
    ? window.location.hostname || "localhost"
    : "herobyte-server.onrender.com";
  const wsPort = import.meta.env.DEV ? ":8787" : "";
  const protocol = import.meta.env.DEV ? "ws:" : "wss:";
  computedWsUrl = `${protocol}//${wsHost}${wsPort}`;
}

export const WS_URL = computedWsUrl;

console.log(
  "[Config] WebSocket URL:",
  WS_URL,
  wsOverride ? "(URL override)" : import.meta.env.VITE_WS_URL ? "(from env)" : "(auto-detected)",
);

const dragPreviewEnv = import.meta.env.VITE_ENABLE_DRAG_PREVIEWS;
export const ENABLE_DRAG_PREVIEWS =
  typeof dragPreviewEnv === "string" ? dragPreviewEnv.toLowerCase() === "true" : false;
