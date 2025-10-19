import { unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Global setup - runs once before all tests
 * Clears the server state file to ensure tests start with a clean slate
 */
export default function globalSetup() {
  const stateFilePath = resolve(__dirname, "../server/herobyte-state.json");

  try {
    unlinkSync(stateFilePath);
    console.log("[E2E Setup] Cleared server state file");
  } catch (err) {
    // File doesn't exist, which is fine
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[E2E Setup] Failed to clear state file:", err);
    }
  }
}
