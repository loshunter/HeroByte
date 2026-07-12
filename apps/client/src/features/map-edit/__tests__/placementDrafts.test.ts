import { describe, it, expect } from "vitest";
import type { MapDocument } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import {
  buildStampPlacement,
  buildTilePlacement,
  scatterSeedFromPoint,
  tileFootprint,
} from "../placementDrafts";

// An 8192px doc at grid 50 with an objects layer (place target) and a walls layer.
function makeDocument(overrides: Partial<MapDocument> = {}): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Live Map",
    width: 8192,
    height: 8192,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: [
      {
        id: "objects",
        name: "Objects",
        kind: "objects",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 20,
      },
      {
        id: "walls",
        name: "Walls",
        kind: "walls",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 30,
      },
    ],
    elements: [],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const crate = getMapStudioTileAsset("objects:crate"); // 1×1
const table = getMapStudioTileAsset("objects:table"); // 2×1

describe("buildTilePlacement", () => {
  it("snaps a click to the grid lattice and picks the matching-kind layer", () => {
    const draft = buildTilePlacement(makeDocument(), crate, { x: 110, y: 90 });
    expect(draft).toEqual({
      layerId: "objects",
      assetId: "objects:crate",
      x: 100,
      y: 100,
      columns: 1,
      rows: 1,
    });
  });

  it("refuses to stack an identical tile already at the cell", () => {
    const document = makeDocument({
      elements: [
        {
          id: "t1",
          layerId: "objects",
          type: "tile",
          locked: false,
          hidden: false,
          transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { assetId: "objects:crate", columns: 1, rows: 1 },
        },
      ],
    });
    expect(buildTilePlacement(document, crate, { x: 110, y: 90 })).toBeNull();
  });

  it("returns null when no layer accepts the asset (all locked)", () => {
    const document = makeDocument({
      layers: [
        {
          id: "objects",
          name: "Objects",
          kind: "objects",
          visible: true,
          locked: true,
          opacity: 1,
          zIndex: 20,
        },
      ],
    });
    expect(buildTilePlacement(document, crate, { x: 100, y: 100 })).toBeNull();
  });
});

describe("buildStampPlacement", () => {
  it("centers a free stamp on the cursor and carries the rotation", () => {
    const draft = buildStampPlacement(makeDocument(), crate, { x: 200, y: 200 }, 90);
    expect(draft).toEqual({
      layerId: "objects",
      assetId: "objects:crate",
      x: 175, // 200 - 50/2
      y: 175,
      width: 50,
      height: 50,
      rotation: 90,
    });
  });

  it("omits rotation entirely when it is zero", () => {
    const draft = buildStampPlacement(makeDocument(), crate, { x: 200, y: 200 }, 0);
    expect(draft).not.toHaveProperty("rotation");
  });

  it("sizes a multi-cell stamp by its footprint", () => {
    const draft = buildStampPlacement(makeDocument(), table, { x: 300, y: 300 }, 0);
    expect(draft?.width).toBe(100); // 2 columns × 50
    expect(draft?.height).toBe(50);
  });
});

describe("tileFootprint", () => {
  it("matches the tile placement position and footprint size", () => {
    const foot = tileFootprint(makeDocument(), table, { x: 260, y: 240 });
    expect(foot).toEqual({ x: 250, y: 250, width: 100, height: 50 });
  });
});

describe("scatterSeedFromPoint", () => {
  it("is deterministic: sub-pixel jitter that rounds to the same cell yields the same seed", () => {
    expect(scatterSeedFromPoint({ x: 100.2, y: 99.8 })).toBe(
      scatterSeedFromPoint({ x: 100, y: 100 }),
    );
  });

  it("differs for distinct drop points", () => {
    expect(scatterSeedFromPoint({ x: 100, y: 100 })).not.toBe(
      scatterSeedFromPoint({ x: 150, y: 100 }),
    );
  });

  it("returns a non-negative uint32", () => {
    const seed = scatterSeedFromPoint({ x: -400, y: 900 });
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(seed)).toBe(true);
  });
});
