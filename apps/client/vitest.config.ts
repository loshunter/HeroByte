import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    pool: "forks",
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage",
    },
    css: false,
  },
});
