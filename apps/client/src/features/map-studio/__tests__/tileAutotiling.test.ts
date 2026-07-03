import { describe, expect, it } from "vitest";
import type { MapDocument, MapElement } from "@herobyte/shared";
import { createMapDocument } from "@herobyte/shared";
import { buildTileOccupancy, isAutotileCandidate, tileBoundaryPath } from "../tileAutotiling";

type TileElement = Extract<MapElement, { type: "tile" }>;

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

function tile(
  id: string,
  x: number,
  y: number,
  overrides: {
    assetId?: string;
    columns?: number;
    rows?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    hidden?: boolean;
  } = {},
): TileElement {
  return {
    id,
    type: "tile",
    layerId: "terrain",
    locked: false,
    hidden: overrides.hidden ?? false,
    transform: {
      x,
      y,
      scaleX: overrides.scaleX ?? 1,
      scaleY: overrides.scaleY ?? 1,
      rotation: overrides.rotation ?? 0,
    },
    data: {
      assetId: overrides.assetId ?? "terrain:stone-floor",
      columns: overrides.columns ?? 1,
      rows: overrides.rows ?? 1,
    },
  };
}

function documentWith(...elements: MapElement[]): MapDocument {
  const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
  document.elements.push(...elements);
  return document;
}

describe("buildTileOccupancy", () => {
  it("maps every covered grid cell of a multi-cell tile to its asset", () => {
    const occupancy = buildTileOccupancy(documentWith(tile("t", 100, 50, { columns: 2, rows: 3 })));

    expect(occupancy.get("2,1")).toBe("terrain:stone-floor");
    expect(occupancy.get("3,1")).toBe("terrain:stone-floor");
    expect(occupancy.get("2,3")).toBe("terrain:stone-floor");
    expect(occupancy.get("3,3")).toBe("terrain:stone-floor");
    expect(occupancy.size).toBe(6);
  });

  it("skips hidden, rotated, scaled, and off-lattice tiles", () => {
    const occupancy = buildTileOccupancy(
      documentWith(
        tile("hidden", 0, 0, { hidden: true }),
        tile("rotated", 50, 0, { rotation: 90 }),
        tile("scaled", 100, 0, { scaleX: 2 }),
        tile("off-lattice", 74, 0),
      ),
    );

    expect(occupancy.size).toBe(0);
  });

  it("lets later elements overwrite earlier ones on the same cell", () => {
    const occupancy = buildTileOccupancy(
      documentWith(tile("under", 0, 0), tile("over", 0, 0, { assetId: "terrain:water" })),
    );

    expect(occupancy.get("0,0")).toBe("terrain:water");
  });

  it("bins against the grid offsets when the document lattice is shifted", () => {
    const document = documentWith(tile("a", 25, 35), tile("b", 75, 35));
    document.grid.offsetX = 25;
    document.grid.offsetY = 35;

    const occupancy = buildTileOccupancy(document);

    expect(occupancy.get("0,0")).toBe("terrain:stone-floor");
    expect(occupancy.get("1,0")).toBe("terrain:stone-floor");
    expect(occupancy.size).toBe(2);
  });
});

describe("isAutotileCandidate", () => {
  it("accepts a plain lattice-aligned tile", () => {
    expect(isAutotileCandidate(tile("t", 0, 0), GRID)).toBe(true);
  });

  it("rejects transformed or hidden tiles and other element types", () => {
    expect(isAutotileCandidate(tile("r", 0, 0, { rotation: 45 }), GRID)).toBe(false);
    expect(isAutotileCandidate(tile("s", 0, 0, { scaleY: 0.5 }), GRID)).toBe(false);
    expect(isAutotileCandidate(tile("h", 0, 0, { hidden: true }), GRID)).toBe(false);
    const text: MapElement = {
      id: "label",
      type: "text",
      layerId: "notes",
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { text: "hi", color: "#fff", fontSize: 12, visibleToPlayers: true },
    };
    expect(isAutotileCandidate(text, GRID)).toBe(false);
  });

  it("rejects off-lattice tiles so they cannot be re-binned into the wrong cell", () => {
    // x=74 would round to cell 1 (pixel 50) — 24px away from where the tile
    // actually renders. x=1998 is the edge-clamp artifact of a 2048px doc.
    expect(isAutotileCandidate(tile("free", 74, 0), GRID)).toBe(false);
    expect(isAutotileCandidate(tile("edge", 1998, 0), GRID)).toBe(false);
    expect(isAutotileCandidate(tile("free-y", 0, 33), GRID)).toBe(false);
  });

  it("accepts tiles aligned to a shifted lattice and rejects strays from it", () => {
    const offsetGrid = { size: 50, offsetX: 25, offsetY: 35 };
    expect(isAutotileCandidate(tile("aligned", 75, 85), offsetGrid)).toBe(true);
    expect(isAutotileCandidate(tile("stray", 50, 85), offsetGrid)).toBe(false);
  });

  it("tolerates float dust from imported documents", () => {
    expect(isAutotileCandidate(tile("dusty", 49.99999, 100.00001), GRID)).toBe(true);
  });
});

describe("tileBoundaryPath", () => {
  it("outlines an isolated tile on all four sides", () => {
    const lone = tile("lone", 100, 100);
    const occupancy = buildTileOccupancy(documentWith(lone));

    const path = tileBoundaryPath(lone, GRID, occupancy);

    expect(path).toContain("M 0 0 H 50");
    expect(path).toContain("M 0 50 H 50");
    expect(path).toContain("M 0 0 V 50");
    expect(path).toContain("M 50 0 V 50");
  });

  it("omits the shared edge between same-terrain neighbors", () => {
    const left = tile("left", 0, 0);
    const right = tile("right", 50, 0);
    const occupancy = buildTileOccupancy(documentWith(left, right));

    expect(tileBoundaryPath(left, GRID, occupancy)).not.toContain("M 50 0 V 50");
    expect(tileBoundaryPath(right, GRID, occupancy)).not.toContain("M 0 0 V 50");
  });

  it("keeps the edge where terrains differ", () => {
    const stone = tile("stone", 0, 0);
    const water = tile("water", 50, 0, { assetId: "terrain:water" });
    const occupancy = buildTileOccupancy(documentWith(stone, water));

    expect(tileBoundaryPath(stone, GRID, occupancy)).toContain("M 50 0 V 50");
  });

  it("does not fuse against an off-lattice tile that merely rounds to the next cell", () => {
    // The review repro: snap off, stone at x=0 and x=74. The old code binned
    // x=74 to cell 1 and suppressed both facing borders across a 24px gap.
    const left = tile("left", 0, 0);
    const floating = tile("floating", 74, 0);
    const occupancy = buildTileOccupancy(documentWith(left, floating));

    expect(occupancy.size).toBe(1);
    expect(tileBoundaryPath(left, GRID, occupancy)).toContain("M 50 0 V 50");
  });

  it("fuses neighbors on a shifted lattice", () => {
    const document = documentWith(tile("a", 25, 35), tile("b", 75, 35));
    document.grid.offsetX = 25;
    document.grid.offsetY = 35;
    const occupancy = buildTileOccupancy(document);
    const grid = { size: 50, offsetX: 25, offsetY: 35 };

    expect(tileBoundaryPath(tile("a", 25, 35), grid, occupancy)).not.toContain("M 50 0 V 50");
    expect(tileBoundaryPath(tile("b", 75, 35), grid, occupancy)).not.toContain("M 0 0 V 50");
  });

  it("draws no interior seams inside a multi-cell tile", () => {
    const slab = tile("slab", 0, 0, { columns: 2, rows: 2 });
    const occupancy = buildTileOccupancy(documentWith(slab));

    const path = tileBoundaryPath(slab, GRID, occupancy);

    expect(path).not.toContain("M 50 0 V 50");
    expect(path).not.toContain("M 0 50 H 50");
    expect(path).toContain("M 0 0 H 50");
    expect(path).toContain("M 100 50 V 100");
  });

  it("returns an empty path for a fully surrounded cell", () => {
    const center = tile("center", 50, 50);
    const ring = [tile("n", 50, 0), tile("s", 50, 100), tile("w", 0, 50), tile("e", 100, 50)];
    const occupancy = buildTileOccupancy(documentWith(center, ...ring));

    expect(tileBoundaryPath(center, GRID, occupancy)).toBe("");
  });
});
