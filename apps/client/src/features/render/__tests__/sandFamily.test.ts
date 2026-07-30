// Warm coastal sand — the SECOND interleave pair (island benchmark arc).
// Pins: sand↔grass echo islands cross the seam in BOTH directions while the
// shipped grass↔dirt pair keeps working in the same scene (two independent
// pairs, one shared machinery), and the family is wired through the map-edit
// floor lists + starter tiles.

import { describe, expect, it } from "vitest";
import { createTerrainField } from "../proceduralTerrain";
import { buildProceduralFieldConfig } from "../proceduralTerrainSurface";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import { floorFamilyFromAssetId } from "../../map-edit/mapEditFamilies";
import { MAP_STUDIO_TILE_ASSETS } from "../../map-studio/starterTileAssets";
import type { StructuredTerrainLayer, TerrainCellRect } from "../tileRenderCore";

const SIZE = 50;
const GRID = { size: SIZE, offsetX: 0, offsetY: 0 };

const cellRect = (cellX: number, cellY: number): TerrainCellRect => ({
  x: cellX * SIZE,
  y: cellY * SIZE,
  size: SIZE,
  cellX,
  cellY,
});

function block(assetId: string, x0: number, y0: number, x1: number, y1: number) {
  const cells: TerrainCellRect[] = [];
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) cells.push(cellRect(cx, cy));
  }
  return { assetId, cells, edges: [] } as StructuredTerrainLayer;
}

/** Classifiers: VILLAGE sand is warm tan (r-dominant, bright), grass is
 * g-dominant, dirt is r-dominant but DARK — the brightness gate splits them. */
const isSandish = ([r, g, b]: [number, number, number]): boolean =>
  r > 160 && r > b + 40 && g > 130;
const isGrassish = ([r, g]: [number, number, number]): boolean => g > r + 10;

describe("sand↔grass interleave (the second pair)", () => {
  // Sand columns 0–7, grass 8–15, dirt 16–23: BOTH pairs share one scene and
  // a tall seam so the noise tails land somewhere on each run.
  const layers = [
    block("terrain:sand", 0, 0, 7, 19),
    block("terrain:grass", 8, 0, 15, 19),
    block("terrain:dirt", 16, 0, 23, 19),
  ];
  const field = createTerrainField(
    buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN)!.config,
  );

  const scan = (
    x0: number,
    x1: number,
    predicate: (rgb: [number, number, number]) => boolean,
  ): number => {
    let hits = 0;
    for (let wy = 60; wy < 940; wy += 4) {
      for (let wx = x0; wx < x1; wx += 4) {
        const c = field.colorAt(wx, wy);
        if (c && predicate(c)) hits += 1;
      }
    }
    return hits;
  };

  it("sand islands appear INSIDE grass, a cell or more past the seam", () => {
    // One to two cells inside grass (columns 9–10 ⇒ 450–550px).
    expect(scan(455, 545, isSandish)).toBeGreaterThan(0);
  });

  it("carves sand so grass shows through west of the seam", () => {
    // One to two cells inside sand (columns 5–6 ⇒ 250–350px).
    expect(scan(255, 345, isGrassish)).toBeGreaterThan(0);
  });

  it("leaves the shipped grass↔dirt pair alive in the same scene", () => {
    // Grass islands inside dirt (columns 17–18 ⇒ 850–950px).
    expect(scan(855, 945, isGrassish)).toBeGreaterThan(0);
  });

  it("is reachable from the map-edit floor lists and the starter tiles", () => {
    expect(floorFamilyFromAssetId("terrain:sand")).toBe("sand");
    const asset = MAP_STUDIO_TILE_ASSETS.find((a) => a.id === "terrain:sand");
    expect(asset?.fill).toBe(VILLAGE_TERRAIN["terrain:sand"]!.base);
  });
});
