import { describe, expect, it } from "vitest";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { createMapDocument } from "@herobyte/shared";
import { paintTerrain as paintTerrainDoc } from "@herobyte/shared";
import {
  buildStampDraft,
  paintPlacementBounds,
  sampleAssetAtPoint,
  topmostTileAtPoint,
} from "../components/mapStudioWorkspaceUtils";
import { getMapStudioTileAsset } from "../starterTiles";

describe("paintPlacementBounds", () => {
  it("keeps the raw fit range when snapping is off", () => {
    expect(paintPlacementBounds(2048, 1, 50, 0, false)).toEqual({ min: 0, max: 1998 });
  });

  it("lands the max on the lattice when the document is not a grid multiple", () => {
    // 2048px doc, 50px grid: the old clamp minted off-lattice tiles at 1998.
    expect(paintPlacementBounds(2048, 1, 50, 0, true)).toEqual({ min: 0, max: 1950 });
  });

  it("keeps grid-multiple documents unchanged", () => {
    expect(paintPlacementBounds(2000, 1, 50, 0, true)).toEqual({ min: 0, max: 1950 });
    expect(paintPlacementBounds(200, 2, 50, 0, true)).toEqual({ min: 0, max: 100 });
  });

  it("respects grid offsets on both ends", () => {
    // Offset 25: lattice runs 25, 75, ..., so min is 25 and max is the last
    // lattice point that still fits a one-cell tile inside 2048.
    expect(paintPlacementBounds(2048, 1, 50, 25, true)).toEqual({ min: 25, max: 1975 });
  });

  it("falls back to the raw range when no lattice position fits", () => {
    expect(paintPlacementBounds(40, 1, 50, 0, true)).toEqual({ min: 0, max: -10 });
  });
});

describe("buildStampDraft", () => {
  it("centers the stamp on the cursor, rounded to whole pixels and clamped", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const asset = getMapStudioTileAsset("objects:crate");

    expect(buildStampDraft(document, asset, { x: 73.4, y: 61.6 })).toEqual({
      layerId: "objects",
      assetId: "objects:crate",
      x: 48,
      y: 37,
      width: 50,
      height: 50,
    });
    expect(buildStampDraft(document, asset, { x: 2047, y: -10 })).toEqual(
      expect.objectContaining({ x: 1998, y: 0 }),
    );
  });
});

describe("sampleAssetAtPoint", () => {
  it("prefers the topmost tile element under the cursor", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.elements = [
      {
        id: "crate",
        type: "tile",
        layerId: "objects",
        locked: false,
        hidden: false,
        transform: { x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", columns: 1, rows: 1 },
      },
    ];
    const layers = new Map<string, MapLayer>(document.layers.map((layer) => [layer.id, layer]));

    expect(sampleAssetAtPoint(document, layers, { x: 60, y: 60 })).toBe("objects:crate");
  });

  it("falls back to the painted terrain cell when no element is stacked", () => {
    let document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document = paintTerrainDoc(document, [{ x: 1, y: 1, assetId: "terrain:water" }]);
    const layers = new Map<string, MapLayer>(document.layers.map((layer) => [layer.id, layer]));

    expect(sampleAssetAtPoint(document, layers, { x: 60, y: 60 })).toBe("terrain:water");
  });

  it("returns null over empty canvas", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const layers = new Map<string, MapLayer>(document.layers.map((layer) => [layer.id, layer]));

    expect(sampleAssetAtPoint(document, layers, { x: 60, y: 60 })).toBeNull();
  });
});

describe("topmostTileAtPoint", () => {
  it("hit-tests rotated stamps in their rotated footprint, not the old bounding box", () => {
    // A 100x20 plank rotated 90deg around its center (50,10) stands vertical:
    // it covers x in [40,60], y in [-40,60].
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const plank: MapElement = {
      id: "plank",
      type: "stamp",
      layerId: "objects",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 90 },
      data: { assetId: "objects:crate", width: 100, height: 20 },
    };
    document.elements = [plank];
    const layers = new Map<string, MapLayer>(document.layers.map((layer) => [layer.id, layer]));

    expect(topmostTileAtPoint(document, layers, { x: 50, y: 50 })?.id).toBe("plank");
    // Inside the unrotated 100x20 box but outside the rotated plank.
    expect(topmostTileAtPoint(document, layers, { x: 90, y: 18 })).toBeNull();
  });
});
