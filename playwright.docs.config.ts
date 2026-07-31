import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Documentation screenshot harness. Reuses the E2E stack (isolated ports,
// fresh room state) but only runs the docs capture file, which the normal
// `pnpm test:e2e` run never matches (it is not a *.spec.ts).
// Run with `pnpm docs:screenshots`; images land in docs/user-guide/img/.
export default defineConfig({
  ...baseConfig,
  testMatch: /docs-screenshots\..+\.ts$/,
  timeout: 180_000,
  retries: 0,
});
