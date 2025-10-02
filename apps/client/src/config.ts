// ============================================================================
// CLIENT CONFIGURATION
// ============================================================================
// Environment-aware configuration for the client application

/**
 * WebSocket server URL
 * - Production (Cloudflare Pages): Uses VITE_WS_URL from environment
 * - Development (.env.development): ws://localhost:8787
 *
 * IMPORTANT: Always set VITE_WS_URL in environment - no fallback logic
 */
export const WS_URL = import.meta.env.VITE_WS_URL;

if (!WS_URL) {
  throw new Error('VITE_WS_URL environment variable is required');
}

console.log('[Config] WebSocket URL:', WS_URL);
