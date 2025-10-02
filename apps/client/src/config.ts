// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================
// Environment-aware configuration for the client application

/**
 * WebSocket server URL
 * - In production: Uses VITE_WS_URL from environment variables (set by Cloudflare Pages)
 * - In development: Auto-detects from the current page hostname
 */
export const WS_URL = import.meta.env.VITE_WS_URL || (() => {
  // Auto-detect: use the same hostname as the web page
  const wsHost = window.location.hostname || 'localhost';
  return `ws://${wsHost}:8787`;
})();
