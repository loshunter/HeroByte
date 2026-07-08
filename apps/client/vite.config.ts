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
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";

const bundleStatsFile = process.env.HEROBYTE_BUNDLE_STATS_FILE ?? "./dist/stats.html";

/**
 * The map-publish flow uploads the baked raster to the game server's HTTP
 * /assets endpoint and the table then loads it back as an <img>. Both are
 * cross-origin (the client and server never share an origin — pages.dev vs
 * onrender in prod, :5174 vs :8787 in dev), so the CSP must name the server's
 * HTTP(S) origin in connect-src (upload/fetch) AND img-src (display). We inject
 * it at build/serve time from the WS target so production stays tight (no dev
 * hosts) while dev/e2e resolve to their local servers.
 */
function serverOriginCsp(command: "build" | "serve"): Plugin {
  return {
    name: "herobyte-server-origin-csp",
    transformIndexHtml(html) {
      const origins = new Set<string>(["https://herobyte-server.onrender.com"]);
      const wsUrl = process.env.VITE_WS_URL;
      if (wsUrl) {
        try {
          const parsed = new URL(wsUrl);
          const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
          origins.add(`${protocol}//${parsed.host}`);
        } catch {
          // An unparseable override just leaves the defaults in place.
        }
      }
      // Dev serves over http on the page's own host (smart-hostname detection
      // targets :8787). Keep this dev-only so the production CSP never names a
      // localhost origin.
      if (command === "serve") {
        origins.add("http://localhost:8787");
        origins.add("http://127.0.0.1:8787");
      }
      return html.replace(/__HB_SERVER_ORIGINS__/g, [...origins].join(" "));
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tsconfigPaths(),
    serverOriginCsp(command),
    visualizer({
      filename: bundleStatsFile,
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    host: "0.0.0.0", // Listen on all network interfaces
    port: 5174,
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
}));
