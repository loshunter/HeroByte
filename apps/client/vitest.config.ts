import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const isCI = Boolean(process.env.CI && process.env.CI !== "false" && process.env.CI !== "0");
const shouldSilenceConsoleOutput = process.env.VITEST_SILENT === "true" || isCI;

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    pool: "forks",
    silent: shouldSilenceConsoleOutput,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage",
    },
    css: false,
  },
});
