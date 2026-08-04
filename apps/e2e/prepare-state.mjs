import { rm, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const files = [
  process.env.E2E_STATE_FILE ?? "herobyte-state.e2e.json",
  process.env.E2E_MAP_STORE_FILE ?? "herobyte-maps.e2e.json",
];

for (const file of files) {
  const filePath = resolve(currentDir, "../server", file);

  try {
    await unlink(filePath);
    console.log(`[E2E Setup] Cleared ${file}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

// The e2e asset store (playwright.config.ts points HEROBYTE_ASSET_DIR here so
// upload tests never touch the real, git-tracked herobyte-assets/).
const assetDir = resolve(
  currentDir,
  "../server",
  process.env.E2E_ASSET_DIR ?? "herobyte-assets-e2e",
);
await rm(assetDir, { recursive: true, force: true });
console.log(`[E2E Setup] Cleared ${assetDir}`);
