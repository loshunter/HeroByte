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
import { createEmptyRoomState } from "../../../domains/room/model.js";
import { installedSceneBytes, liveSceneBytes, mintSceneBytes } from "../liveSceneBytes.js";
import { compileDocument } from "../sceneTravel.js";

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

/** The same map with scenery on it — the part a PUBLISH leaves out of the export. */
function withTiles(document: MapDocument, tiles: number): MapDocument {
  const layer = document.layers.find((entry) => entry.kind === "objects")!;
  for (let i = 0; i < tiles; i++) {
    document.elements.push({
      id: `${document.id}-tile-${i}`,
      layerId: layer.id,
      type: "tile",
      locked: false,
      hidden: false,
      transform: { x: i * 50, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { assetId: "tile:crate", columns: 1, rows: 1 },
    } as never);
  }
  return document;
}

describe("mintSceneBytes", () => {
  function withInstalled(document: MapDocument): ReturnType<typeof createEmptyRoomState> {
    const state = createEmptyRoomState();
    const outputs = compileDocument(document, 1, undefined);
    state.compiledScene = outputs.compiledScene;
    state.mapTerrain = outputs.mapTerrain;
    state.mapElements = outputs.mapElements;
    state.gridSize = outputs.gridSize;
    state.gridSquareSize = outputs.gridSquareSize;
    state.liveMapDocumentId = document.id;
    return state;
  }

  it("swaps the scene INSTALLED on the table out — for the live GENERATE tool that is the live document's own, as it stands", () => {
    const stored = wallDocument("live", 40);
    const state = withInstalled(stored);
    const candidate = wallDocument("live", 80); // the document as it would be after the recipe

    const scene = mintSceneBytes(state, candidate, 1);

    expect(scene.candidate).toBe(liveSceneBytes(candidate, 1));
    expect(scene.outgoing).toBe(installedSceneBytes(state));
    expect(scene.outgoing).toBe(liveSceneBytes(stored, 1));
    expect(scene.candidate).toBeGreaterThan(scene.outgoing);
    expect(scene.outgoing).toBeGreaterThan(1000);
  });

  it("measures what a PUBLISH left installed — the compiled scene alone, never a recompile of the bound document", () => {
    const stored = withTiles(wallDocument("published", 40), 30);
    const state = withInstalled(stored);
    // publishDocument overwrites two of the five keys (mapStudioPublish.ts).
    state.mapTerrain = undefined;
    state.mapElements = undefined;

    const scene = mintSceneBytes(state, wallDocument("child", 10), 1);

    expect(scene.outgoing).toBe(installedSceneBytes(state));
    expect(scene.outgoing).toBeLessThan(liveSceneBytes(stored, 1));
    expect(scene.outgoing).toBeGreaterThan(1000);
  });

  it("still counts a scene the binding no longer names — an unbind or a delete of the live map keeps the scene on the table", () => {
    const state = withInstalled(wallDocument("gone", 40));
    state.liveMapDocumentId = undefined;

    expect(mintSceneBytes(state, wallDocument("child", 10), 1).outgoing).toBeGreaterThan(1000);
  });

  it("swaps nothing out when nothing is compiled", () => {
    const state = createEmptyRoomState();
    state.liveMapDocumentId = "dangling";
    expect(mintSceneBytes(state, wallDocument("child", 10), 1).outgoing).toBe(0);
    expect(installedSceneBytes(createEmptyRoomState())).toBe(0);
  });
});
