// Sea-crag cliff — stacked-ledge crag family (taxonomy family roster). Pins:
// the interior quantizes into rim-within-rim courses (ink contours + the dark
// outer ledge + the pale core all present), the knob is gated (stripping
// `ledges` leaves a plain base interior), and the family is wired through the
// map-edit floor lists so the paint tool and eyedropper can reach it.

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

// A coast section: open water columns 0–3, the crag band 4–5, grass cap 6–9.
const layers = [
  block("terrain:water", 0, 0, 3, 9),
  block("terrain:cliff", 4, 0, 5, 9),
  block("terrain:grass", 6, 0, 9, 9),
];

/** Course classifiers on the VILLAGE crag ramp (#2b4152 → #565e62 + #26282a
 * ink). The dark outer ledge is blue-dominant; the water that could bleed at
 * a receded bump is the TEAL shallow band (green-dominant), so the classes
 * cannot collide. Tolerances absorb the mottle. */
const isInk = ([r, g, b]: [number, number, number]): boolean => r < 55 && g < 55 && b < 60;
const isDeepLedge = ([r, g, b]: [number, number, number]): boolean =>
  b > r + 25 && g < 78 && !isInk([r, g, b]);
const isPaleLedge = ([r, g, b]: [number, number, number]): boolean =>
  r >= 65 && r <= 105 && g >= 75 && g <= 112 && Math.abs(b - r) < 22;

function scanBand(
  field: ReturnType<typeof createTerrainField>,
  x0: number,
  x1: number,
  predicate: (rgb: [number, number, number]) => boolean,
): number {
  let hits = 0;
  for (let wy = 54; wy < 446; wy += 2) {
    for (let wx = x0; wx < x1; wx += 2) {
      const c = field.colorAt(wx, wy);
      if (c && predicate(c)) hits += 1;
    }
  }
  return hits;
}

describe("sea-crag cliff (stacked ledges)", () => {
  const field = createTerrainField(buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN)!.config);

  it("quantizes the crag interior into courses: ink contours, dark outer ledge, pale core", () => {
    // The full band strip (cliff columns 4–5 ⇒ 200–300px) carries all three.
    expect(scanBand(field, 204, 296, isInk)).toBeGreaterThan(0);
    expect(scanBand(field, 204, 296, isDeepLedge)).toBeGreaterThan(0);
    expect(scanBand(field, 204, 296, isPaleLedge)).toBeGreaterThan(0);
  });

  it("gates on the knob: stripping `ledges` leaves a plain base interior", () => {
    const noKnob: Record<string, (typeof VILLAGE_TERRAIN)[string]> = {
      ...VILLAGE_TERRAIN,
      "terrain:cliff": { ...VILLAGE_TERRAIN["terrain:cliff"]!, ledges: undefined },
    };
    const plain = createTerrainField(buildProceduralFieldConfig(layers, GRID, noKnob)!.config);
    // Away from the silhouette rim, no blue-dominant course tones remain.
    expect(scanBand(plain, 220, 280, isDeepLedge)).toBe(0);
    expect(scanBand(plain, 220, 280, isPaleLedge)).toBeGreaterThan(0);
  });

  it("is reachable from the map-edit floor lists and the starter tiles", () => {
    expect(floorFamilyFromAssetId("terrain:cliff")).toBe("cliff");
    const asset = MAP_STUDIO_TILE_ASSETS.find((a) => a.id === "terrain:cliff");
    expect(asset?.fill).toBe(VILLAGE_TERRAIN["terrain:cliff"]!.base);
  });
});
