/**
 * Vite Build Configuration
 *
 * Code Splitting Strategy:
 * - MapBoard: Lazy loaded after authentication (~106 KB gzipped deferred)
 * - vendor-konva: Canvas rendering (konva + react-konva)
 * - vendor-voice: WebRTC voice chat (simple-peer)
 * - vendor-react: React core (react + react-dom)
 *
 * Bundle Analysis:
 * Run `pnpm --filter herobyte-client build:analyze`
 * View results in: dist/stats.html
 *
 * Performance Impact:
 * - Initial load: ~106 KB gzipped (auth shell only, no Konva/voice)
 * - Post-auth load: ~106 KB gzipped (MapBoard + Konva)
 * - First mic toggle: ~30 KB gzipped (SimplePeer for voice chat)
 * - ~50% reduction in time-to-interactive for unauthenticated users
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    host: "0.0.0.0", // Listen on all network interfaces
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Canvas rendering libraries (large dependencies)
          "vendor-konva": ["konva", "react-konva"],
          // Voice chat peer connections
          "vendor-voice": ["simple-peer"],
          // React core
          "vendor-react": ["react", "react-dom"],
        },
      },
    },
  },
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
      process: "process/browser",
      util: "util",
      events: "events",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
