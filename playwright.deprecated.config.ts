import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig(baseConfig, {
  testIgnore: [],
  testMatch:
    /(?:character-creation|partial-erase|player-npc-initiative|session-load|staging-zone|transform-tool)\.spec\.ts/,
});
