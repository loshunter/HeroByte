// vitest.config.ts
import { configDefaults, defineConfig } from "file:///D:/HeroByte/node_modules/.pnpm/vitest@3.2.4_@types+node@24.6.1_jsdom@24.1.3/node_modules/vitest/dist/config.js";
import react from "file:///D:/HeroByte/node_modules/.pnpm/@vitejs+plugin-react@5.0.4_vite@5.4.20_@types+node@24.6.1_/node_modules/@vitejs/plugin-react/dist/index.js";
import tsconfigPaths from "file:///D:/HeroByte/node_modules/.pnpm/vite-tsconfig-paths@5.1.4_t_09ca7c36ada17ec214a3c5cb1344d4d3/node_modules/vite-tsconfig-paths/dist/index.js";
var isCI = Boolean(process.env.CI && process.env.CI !== "false" && process.env.CI !== "0");
var shouldSilenceConsoleOutput = process.env.VITEST_SILENT === "true" || isCI;
var isolatedTestFiles = [
  "**/__tests__/**/webrtc*.test.{ts,tsx}",
  "**/__tests__/**/MapBoard*.test.{ts,tsx}"
];
var vitest_config_default = defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          pool: "threads",
          exclude: [...configDefaults.exclude, ...isolatedTestFiles]
        }
      },
      {
        extends: true,
        test: {
          name: "isolated",
          pool: "forks",
          include: isolatedTestFiles
        }
      }
    ],
    silent: shouldSilenceConsoleOutput,
    coverage: {
      // Switched to v8 provider for better performance (15-20% faster than istanbul)
      // No Babel transform overhead, better source maps, lower memory usage
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage"
    },
    css: false
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXEhlcm9CeXRlXFxcXGFwcHNcXFxcY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxIZXJvQnl0ZVxcXFxhcHBzXFxcXGNsaWVudFxcXFx2aXRlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9IZXJvQnl0ZS9hcHBzL2NsaWVudC92aXRlc3QuY29uZmlnLnRzXCI7aW1wb3J0IHsgY29uZmlnRGVmYXVsdHMsIGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlc3QvY29uZmlnXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgdHNjb25maWdQYXRocyBmcm9tIFwidml0ZS10c2NvbmZpZy1wYXRoc1wiO1xuXG5jb25zdCBpc0NJID0gQm9vbGVhbihwcm9jZXNzLmVudi5DSSAmJiBwcm9jZXNzLmVudi5DSSAhPT0gXCJmYWxzZVwiICYmIHByb2Nlc3MuZW52LkNJICE9PSBcIjBcIik7XG5jb25zdCBzaG91bGRTaWxlbmNlQ29uc29sZU91dHB1dCA9IHByb2Nlc3MuZW52LlZJVEVTVF9TSUxFTlQgPT09IFwidHJ1ZVwiIHx8IGlzQ0k7XG5jb25zdCBpc29sYXRlZFRlc3RGaWxlcyA9IFtcbiAgXCIqKi9fX3Rlc3RzX18vKiovd2VicnRjKi50ZXN0Lnt0cyx0c3h9XCIsXG4gIFwiKiovX190ZXN0c19fLyoqL01hcEJvYXJkKi50ZXN0Lnt0cyx0c3h9XCIsXG5dO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdHNjb25maWdQYXRocygpXSxcbiAgdGVzdDoge1xuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgc2V0dXBGaWxlczogXCIuL3ZpdGVzdC5zZXR1cC50c1wiLFxuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgcHJvamVjdHM6IFtcbiAgICAgIHtcbiAgICAgICAgZXh0ZW5kczogdHJ1ZSxcbiAgICAgICAgdGVzdDoge1xuICAgICAgICAgIG5hbWU6IFwiZGVmYXVsdFwiLFxuICAgICAgICAgIHBvb2w6IFwidGhyZWFkc1wiLFxuICAgICAgICAgIGV4Y2x1ZGU6IFsuLi5jb25maWdEZWZhdWx0cy5leGNsdWRlLCAuLi5pc29sYXRlZFRlc3RGaWxlc10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBleHRlbmRzOiB0cnVlLFxuICAgICAgICB0ZXN0OiB7XG4gICAgICAgICAgbmFtZTogXCJpc29sYXRlZFwiLFxuICAgICAgICAgIHBvb2w6IFwiZm9ya3NcIixcbiAgICAgICAgICBpbmNsdWRlOiBpc29sYXRlZFRlc3RGaWxlcyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzaWxlbnQ6IHNob3VsZFNpbGVuY2VDb25zb2xlT3V0cHV0LFxuICAgIGNvdmVyYWdlOiB7XG4gICAgICAvLyBTd2l0Y2hlZCB0byB2OCBwcm92aWRlciBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlICgxNS0yMCUgZmFzdGVyIHRoYW4gaXN0YW5idWwpXG4gICAgICAvLyBObyBCYWJlbCB0cmFuc2Zvcm0gb3ZlcmhlYWQsIGJldHRlciBzb3VyY2UgbWFwcywgbG93ZXIgbWVtb3J5IHVzYWdlXG4gICAgICBwcm92aWRlcjogXCJ2OFwiLFxuICAgICAgcmVwb3J0ZXI6IFtcInRleHRcIiwgXCJqc29uXCIsIFwibGNvdlwiXSxcbiAgICAgIHJlcG9ydHNEaXJlY3Rvcnk6IFwiLi9jb3ZlcmFnZVwiLFxuICAgIH0sXG4gICAgY3NzOiBmYWxzZSxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFtUSxTQUFTLGdCQUFnQixvQkFBb0I7QUFDaFQsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sbUJBQW1CO0FBRTFCLElBQU0sT0FBTyxRQUFRLFFBQVEsSUFBSSxNQUFNLFFBQVEsSUFBSSxPQUFPLFdBQVcsUUFBUSxJQUFJLE9BQU8sR0FBRztBQUMzRixJQUFNLDZCQUE2QixRQUFRLElBQUksa0JBQWtCLFVBQVU7QUFDM0UsSUFBTSxvQkFBb0I7QUFBQSxFQUN4QjtBQUFBLEVBQ0E7QUFDRjtBQUVBLElBQU8sd0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDbEMsTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLElBQ1osU0FBUztBQUFBLElBQ1QsVUFBVTtBQUFBLE1BQ1I7QUFBQSxRQUNFLFNBQVM7QUFBQSxRQUNULE1BQU07QUFBQSxVQUNKLE1BQU07QUFBQSxVQUNOLE1BQU07QUFBQSxVQUNOLFNBQVMsQ0FBQyxHQUFHLGVBQWUsU0FBUyxHQUFHLGlCQUFpQjtBQUFBLFFBQzNEO0FBQUEsTUFDRjtBQUFBLE1BQ0E7QUFBQSxRQUNFLFNBQVM7QUFBQSxRQUNULE1BQU07QUFBQSxVQUNKLE1BQU07QUFBQSxVQUNOLE1BQU07QUFBQSxVQUNOLFNBQVM7QUFBQSxRQUNYO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUNBLFFBQVE7QUFBQSxJQUNSLFVBQVU7QUFBQTtBQUFBO0FBQUEsTUFHUixVQUFVO0FBQUEsTUFDVixVQUFVLENBQUMsUUFBUSxRQUFRLE1BQU07QUFBQSxNQUNqQyxrQkFBa0I7QUFBQSxJQUNwQjtBQUFBLElBQ0EsS0FBSztBQUFBLEVBQ1A7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
