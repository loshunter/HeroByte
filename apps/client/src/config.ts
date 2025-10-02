// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================
// Environment-aware configuration for the client application

/**
 * WebSocket server URL
 * - Production (Cloudflare Pages): Uses VITE_WS_URL environment variable
 * - Development (localhost): Connects to ws://localhost:8787
 */
export const WS_URL = import.meta.env.VITE_WS_URL || (() => {
  // Development mode: connect to local server
  if (import.meta.env.DEV) {
    return 'ws://localhost:8787';
  }
  // Fallback: try to connect to server on same host
  const wsHost = window.location.hostname || 'localhost';
  return `ws://${wsHost}:8787`;
})();

console.log('[Config] WebSocket URL:', WS_URL);
