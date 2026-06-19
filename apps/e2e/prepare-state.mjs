import { unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const stateFile = process.env.E2E_STATE_FILE ?? "herobyte-state.e2e.json";
const stateFilePath = resolve(currentDir, "../server", stateFile);

try {
  await unlink(stateFilePath);
  console.log(`[E2E Setup] Cleared ${stateFile}`);
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}
