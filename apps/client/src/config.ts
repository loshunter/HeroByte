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
const wsOverride = urlParams.get('ws');

// Determine WebSocket URL
let computedWsUrl: string;

if (wsOverride) {
  // URL parameter takes highest priority
  computedWsUrl = wsOverride;
} else if (import.meta.env.VITE_WS_URL) {
  // Environment variable second priority
  computedWsUrl = import.meta.env.VITE_WS_URL;
} else if (import.meta.env.DEV) {
  // Development mode: auto-detect from current hostname
  const wsHost = window.location.hostname || 'localhost';
  computedWsUrl = `ws://${wsHost}:8787`;
} else {
  throw new Error('VITE_WS_URL environment variable is required in production');
}

export const WS_URL = computedWsUrl;

console.log('[Config] WebSocket URL:', WS_URL, wsOverride ? '(URL override)' : import.meta.env.VITE_WS_URL ? '(from env)' : '(auto-detected)');
