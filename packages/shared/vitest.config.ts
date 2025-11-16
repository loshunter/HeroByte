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
      exclude: ["**/__tests__/**", "dist/**"],
    },
  },
});
