import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5173);
const HOST = process.env.E2E_HOST ?? "127.0.0.1";
const baseURL = process.env.E2E_BASE_URL ?? `http://${HOST}:${PORT}`;
const WS_PORT = Number(process.env.E2E_WS_PORT ?? 8787);
const WS_HOST = process.env.E2E_WS_HOST ?? "localhost";

export default defineConfig({
  testDir: "./apps/e2e",
  globalSetup: "./apps/e2e/global-setup.ts",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true, // Enable parallel execution with worker-isolated state files
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
      command: `pnpm build:server && VITE_WS_URL=ws://${WS_HOST}:${WS_PORT} pnpm --filter herobyte-client exec vite build --mode development && pnpm --filter vtt-server start:e2e`,
      port: WS_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      // Set worker-specific state file to avoid conflicts in parallel execution
      env: {
        ROOM_STATE_FILE: process.env.PLAYWRIGHT_WORKER_INDEX
          ? `herobyte-state.worker-${process.env.PLAYWRIGHT_WORKER_INDEX}.json`
          : "herobyte-state.json",
      },
    },
    {
      // Serve the built client with vite preview (required for E2E tests to load UI)
      command: "pnpm --filter herobyte-client exec vite preview --port 5173 --strictPort",
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
