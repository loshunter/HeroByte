import { describe, expect, it } from "vitest";
import { buildSnapshotAssets } from "../SnapshotAssetBuilder.js";
import { createEmptyRoomState } from "../../model.js";

describe("buildSnapshotAssets", () => {
  it("creates assets for map background and drawings", () => {
    const state = createEmptyRoomState();
    state.mapBackground = "https://example.com/map.png";
    state.drawings = [
      {
        id: "drawing-1",
        type: "freehand",
        points: [{ x: 0, y: 0 }],
        color: "#fff",
        width: 2,
        opacity: 1,
        owner: "player-1",
      },
    ];

    const result = buildSnapshotAssets(state);

    expect(result.assets).toHaveLength(2);
    expect(result.assetRefs["map-background"]).toBeDefined();
    expect(result.assetRefs.drawings).toBeDefined();
    const mapAsset = result.assets.find((asset) => asset.type === "map-background");
    expect(mapAsset?.payload).toBe(state.mapBackground);
    expect(mapAsset?.hash).toMatch(/^[a-f0-9]{40}$/);
    const drawingsAsset = result.assets.find((asset) => asset.type === "drawings");
    expect(drawingsAsset?.payload).toHaveLength(1);
    expect(drawingsAsset?.encoding).toBe("json");
  });

  it("returns empty arrays when no heavy assets exist", () => {
    const state = createEmptyRoomState();
    const result = buildSnapshotAssets(state);
    expect(result.assets).toHaveLength(0);
    expect(Object.keys(result.assetRefs)).toHaveLength(0);
  });
});
