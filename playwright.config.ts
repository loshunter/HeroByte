import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5173);
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const baseURL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;
const WS_PORT = Number(process.env.E2E_WS_PORT ?? 8787);
const WS_HOST = process.env.E2E_WS_HOST ?? "localhost";
const E2E_STATE_FILE = process.env.E2E_STATE_FILE ?? "herobyte-state.e2e.json";

export default defineConfig({
  testDir: "./apps/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  // HeroByte is intentionally a single-room server. Serial execution prevents
  // one test's reset from invalidating another test's active connection.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    headless: process.env.CI ? true : undefined,
  },
  webServer: [
    {
      // Build and start the Node.js server (WebSocket + API)
      // Build client in development mode so window.__HERO_BYTE_E2E__ is exposed
      // Set VITE_WS_URL during build so client knows to connect to the WebSocket server
      command: `node apps/e2e/prepare-state.mjs && pnpm build:server && cross-env VITE_WS_URL=ws://${WS_HOST}:${WS_PORT} pnpm --filter herobyte-client exec vite build --mode development && pnpm --filter vtt-server start:e2e`,
      port: WS_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        HEROBYTE_ALLOWED_ORIGINS: new URL(baseURL).origin,
        HEROBYTE_E2E: "true",
        E2E_STATE_FILE,
        PORT: String(WS_PORT),
        ROOM_STATE_FILE: E2E_STATE_FILE,
      },
    },
    {
      // Serve the built client with vite preview (required for E2E tests to load UI)
      command: `pnpm --filter herobyte-client exec vite preview --port ${PORT} --strictPort`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
