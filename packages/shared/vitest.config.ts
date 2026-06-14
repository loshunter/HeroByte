import { defineConfig } from "vitest/config";

const isCI = Boolean(process.env.CI && process.env.CI !== "false" && process.env.CI !== "0");
const shouldSilenceConsoleOutput = process.env.VITEST_SILENT === "true" || isCI;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "**/*.test.ts"],
    reporters: [["default", { summary: false }]],
    silent: shouldSilenceConsoleOutput,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["**/__tests__/**", "dist/**", "src/index.ts"],
      // Floor below current coverage (~99.5% lines as of 2026-06) so
      // regressions fail CI.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 90,
        branches: 90,
      },
    },
  },
});
