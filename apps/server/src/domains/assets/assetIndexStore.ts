// ============================================================================
// ASSET INDEX PERSISTENCE
// ============================================================================
// The on-disk index behind AssetService: one JSON file beside the blobs,
// written with the same atomic tmp-and-rename discipline as the other stores.
// Split from the service so it stays under the structural size guard.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredAsset } from "./assetTypes.js";

export interface AssetIndex {
  schemaVersion: 1;
  assets: Record<string, StoredAsset>;
}

/** Missing or corrupt index starts fresh; stored files re-attach on re-upload
 * thanks to content addressing. */
export async function loadAssetIndex(directory: string): Promise<AssetIndex> {
  try {
    const raw = await readFile(path.join(directory, "index.json"), "utf-8");
    const parsed = JSON.parse(raw) as AssetIndex;
    if (parsed?.schemaVersion === 1 && parsed.assets && typeof parsed.assets === "object") {
      return parsed;
    }
  } catch {
    // fall through to the empty index
  }
  return { schemaVersion: 1, assets: {} };
}

/** Callers hold the service's mutation lock, so a plain atomic write is safe. */
export async function writeAssetIndex(directory: string, index: AssetIndex): Promise<void> {
  await mkdir(directory, { recursive: true });
  const indexPath = path.join(directory, "index.json");
  const tmpPath = `${indexPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(index, null, 2));
  await rename(tmpPath, indexPath);
}
