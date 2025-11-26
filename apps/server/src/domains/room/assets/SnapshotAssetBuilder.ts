import { createHash } from "node:crypto";
import type { Drawing, SnapshotAsset, SnapshotAssetRefs } from "@shared";
import type { RoomState } from "../model.js";

interface SnapshotAssetBuildResult {
  assets: SnapshotAsset[];
  assetRefs: SnapshotAssetRefs;
}

function buildAssetSignature(type: SnapshotAsset["type"], payload: string): [string, string] {
  const hash = createHash("sha1").update(payload).digest("hex");
  return [`${type}:${hash}`, hash];
}

function serializeDrawings(drawings: Drawing[]): string {
  return JSON.stringify(drawings);
}

export function buildSnapshotAssets(state: RoomState): SnapshotAssetBuildResult {
  const assets: SnapshotAsset[] = [];
  const assetRefs: SnapshotAssetRefs = {};

  if (state.mapBackground) {
    const payload = state.mapBackground;
    const serialized = payload;
    const [id, hash] = buildAssetSignature("map-background", serialized);
    assets.push({
      id,
      type: "map-background",
      hash,
      size: Buffer.byteLength(serialized, "utf8"),
      encoding: "string",
      payload,
    });
    assetRefs["map-background"] = id;
  }

  if (state.drawings.length > 0) {
    const payload = state.drawings;
    const serialized = serializeDrawings(payload);
    const [id, hash] = buildAssetSignature("drawings", serialized);
    assets.push({
      id,
      type: "drawings",
      hash,
      size: Buffer.byteLength(serialized, "utf8"),
      encoding: "json",
      payload,
    });
    assetRefs.drawings = id;
  }

  return {
    assets,
    assetRefs,
  };
}
