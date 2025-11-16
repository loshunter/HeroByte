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
    pool: "threads",
    poolMatchGlobs: [
      // Use forks only for tests that need true isolation (WebRTC, konva state, etc.)
      ["**/__tests__/**/webrtc*.test.{ts,tsx}", "forks"],
      ["**/__tests__/**/MapBoard*.test.{ts,tsx}", "forks"],
    ],
    silent: shouldSilenceConsoleOutput,
    coverage: {
      // Switched to v8 provider for better performance (15-20% faster than istanbul)
      // No Babel transform overhead, better source maps, lower memory usage
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage",
    },
    css: false,
  },
});
