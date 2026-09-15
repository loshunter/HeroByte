// ============================================================================
// mintSceneBytes — which scene a mint swaps OUT, and which it brings IN
// ============================================================================
// The mint ceiling weighs the export as it would be with the candidate LIVE:
// the outgoing scene's derived data (compiled scene, terrain, scenery) is
// replaced by the candidate's, never counted beside it. Three cases decide
// what "outgoing" is, and the live GENERATE tool's is the subtle one — the
// candidate IS the live document, so the scene being replaced is that
// document's own, as stored. A weigh that forgot this refused generates onto
// the live map about one scene early (round 1 of the review).

import { describe, it, expect } from "vitest";
import { createMapDocument, type MapDocument } from "@herobyte/shared";
import { MapStudioService } from "../../../domains/mapStudio/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import { liveSceneBytes, mintSceneBytes } from "../liveSceneBytes.js";

function wallDocument(id: string, walls: number): MapDocument {
  const document = createMapDocument({ id, name: id, timestamp: 1 });
  const layer = document.layers.find((entry) => entry.kind === "walls")!;
  for (let i = 0; i < walls; i++) {
    document.elements.push({
      id: `${id}-wall-${i}`,
      layerId: layer.id,
      type: "wall",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        points: [
          { x: i * 10, y: 0 },
          { x: i * 10 + 200, y: 0 },
        ],
        blocksMovement: true,
        blocksVision: true,
      },
    } as never);
  }
  return document;
}

describe("mintSceneBytes", () => {
  it("swaps the LIVE document's own stored scene out when the candidate IS the live document (the live GENERATE tool)", () => {
    const maps = new MapStudioService();
    const stored = wallDocument("live", 40);
    maps.restore("r", stored);
    const state = createEmptyRoomState();
    state.liveMapDocumentId = "live";
    const candidate = wallDocument("live", 80); // the document as it would be after the recipe

    const scene = mintSceneBytes(state, maps, "r", candidate, 1);

    expect(scene.candidate).toBe(liveSceneBytes(candidate, 1));
    expect(scene.outgoing).toBe(liveSceneBytes(maps.get("r", "live"), 1));
    expect(scene.candidate).toBeGreaterThan(scene.outgoing);
    expect(scene.outgoing).toBeGreaterThan(1000);
  });

  it("swaps the live document's scene out when the candidate is ANOTHER document (a kick, a generate elsewhere)", () => {
    const maps = new MapStudioService();
    maps.restore("r", wallDocument("origin", 40));
    const state = createEmptyRoomState();
    state.liveMapDocumentId = "origin";

    const scene = mintSceneBytes(state, maps, "r", wallDocument("child", 10), 1);

    expect(scene.outgoing).toBe(liveSceneBytes(maps.get("r", "origin"), 1));
    expect(scene.candidate).toBe(liveSceneBytes(wallDocument("child", 10), 1));
  });

  it("swaps nothing out when no document is live, or when the live document is gone from the store", () => {
    const maps = new MapStudioService();
    const candidate = wallDocument("child", 10);

    const noLive = createEmptyRoomState();
    expect(mintSceneBytes(noLive, maps, "r", candidate, 1).outgoing).toBe(0);

    const dangling = createEmptyRoomState();
    dangling.liveMapDocumentId = "vanished";
    expect(mintSceneBytes(dangling, maps, "r", candidate, 1).outgoing).toBe(0);
  });
});
