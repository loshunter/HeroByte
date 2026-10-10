// Screen capture for the lesson videos. Reuses the e2e stack (isolated ports 5175/8788, a fresh
// table state, the real dev table never touched) but runs only site/video/capture/*.capture.ts.
//
//   pnpm test:e2e -- --config site/video/playwright.capture.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import baseConfig from "../../playwright.config";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const servers = Array.isArray(baseConfig.webServer) ? baseConfig.webServer : [baseConfig.webServer!];

export default defineConfig({
  ...baseConfig,
  testDir: "./capture",
  testMatch: /\.capture\.ts$/,
  timeout: 600_000,
  retries: 0,
  reporter: [["list"]],
  outputDir: path.join(repo, "test-results", "video-capture"),
  // The base config's server commands are written from the repo root.
  webServer: servers.map((server) => ({ ...server, cwd: repo })),
  use: { ...baseConfig.use, video: "off", trace: "off", headless: true },
  projects: [{ name: "capture" }],
});
