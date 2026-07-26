// Foliage canopy (taxonomy catalog rank 9): the terrain families riding the
// levels illusion ABOVE the roofs. Pins the arc's silent-break invariants —
// the canopy crown BFS must be its own body (computeBodyDepths fuses every id
// it is given, so joining the water call would bend both bathymetries), the
// two-tone sun split and core darkening must actually read in the field
// colours, the sub-lobe octave must displace only canopy edges, and the
// structures-block palette split must be byte-verbatim.

import { describe, expect, it } from "vitest";
import { floorFamilyFromAssetId } from "../../map-edit/mapEditFamilies";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { createTerrainField, type TerrainFieldConfig } from "../proceduralTerrain";
import { buildProceduralFieldConfig } from "../proceduralTerrainSurface";
import { CANOPY_HIGHLIGHT_MAX_DEPTH, paintCanopyDetail } from "../terrainCanopyDetail";
import { LEAF_CANOPY_DETAIL } from "../terrainMaterialPalettes";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import type { StructuredTerrainLayer, TerrainCellRect } from "../tileRenderCore";
import { createRecordingContext } from "./recordingContext";

const CANOPY_IDS = ["terrain:canopy", "terrain:canopy-blossom"] as const;
const SIZE = 50;
const GRID = { size: SIZE, offsetX: 0, offsetY: 0 };

const cellRect = (cellX: number, cellY: number): TerrainCellRect => ({
  x: cellX * SIZE,
  y: cellY * SIZE,
  size: SIZE,
  cellX,
  cellY,
});

/** A filled square block of one family as a structured layer. */
function block(assetId: string, x0: number, y0: number, x1: number, y1: number) {
  const cells: TerrainCellRect[] = [];
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) cells.push(cellRect(cx, cy));
  }
  return { assetId, cells, edges: [] } as StructuredTerrainLayer;
}

const luma = ([r, g, b]: [number, number, number]): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("canopy families (assets + palette contract)", () => {
  it("both canopies resolve as terrain assets whose fills match the palette base", () => {
    for (const id of CANOPY_IDS) {
      const asset = getMapStudioTileAsset(id);
      expect(asset.id, id).toBe(id); // not the fallback
      expect(asset.category, id).toBe("terrain");
      expect(asset.layerKind, id).toBe("terrain");
      expect(VILLAGE_TERRAIN[id]!.base, id).toBe(asset.fill);
    }
  });

  it("canopies sit ABOVE every roof with distinct priorities and a long throw", () => {
    const roofMax = Math.max(
      ...Object.values(VILLAGE_TERRAIN)
        .filter((fam) => fam.roof || fam.polar)
        .map((fam) => fam.priority),
    );
    const priorities = CANOPY_IDS.map((id) => VILLAGE_TERRAIN[id]!.priority);
    for (const priority of priorities) expect(priority).toBeGreaterThan(roofMax);
    expect(new Set(priorities).size).toBe(priorities.length);
    for (const id of CANOPY_IDS) {
      const fam = VILLAGE_TERRAIN[id]!;
      expect(fam.canopy, id).toBeDefined();
      expect(fam.edgeAmp, id).toBeGreaterThan(1); // organic, maxed lobes
      expect(fam.shadow!.band, id).toBeGreaterThan(0.15); // long height-cue throw
      expect(fam.contact, id).toBeDefined();
    }
  });

  it("the live palette recognises both canopies as paintable families", () => {
    for (const id of CANOPY_IDS) {
      expect(floorFamilyFromAssetId(id), id).toBe(id.slice("terrain:".length));
    }
  });

  it("the structures-block split kept the architectural data verbatim", () => {
    expect(VILLAGE_TERRAIN["terrain:wall-stone"]!.base).toBe("#b3a687");
    expect(VILLAGE_TERRAIN["terrain:wall-dark"]!.priority).toBe(23);
    expect(VILLAGE_TERRAIN["terrain:roof-dome"]!.polar!.courseWidth).toBe(0.5);
    expect(VILLAGE_TERRAIN["terrain:roof-thatch-spiral"]!.polar!.spiral).toBe(true);
    expect(VILLAGE_TERRAIN["terrain:dais-stone"]!.priority).toBe(11);
    expect(VILLAGE_TERRAIN["terrain:stairs-stone"]!.stairs).toBeDefined();
  });
});

describe("crown-mass BFS (own body, never fused with water)", () => {
  // Water block on the left, canopy block directly adjacent on the right:
  // if the canopy ids joined the water body, the shared seam would stop
  // counting as shore for BOTH and every depth below would shift.
  const layers = [block("terrain:water", 0, 0, 4, 6), block("terrain:canopy", 5, 0, 11, 6)];
  const built = buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN)!;

  it("a canopy cell on the water seam is still crown SHORE (depth 1)", () => {
    expect(built.config.depthOf!("terrain:canopy", 5, 3)).toBe(1);
  });

  it("water bathymetry ignores the adjacent crown (seam stays water shore)", () => {
    expect(built.config.depthOf!("terrain:water", 4, 3)).toBe(1);
  });

  it("crown depth deepens toward the canopy interior", () => {
    expect(built.config.depthOf!("terrain:canopy", 8, 3)).toBeGreaterThanOrEqual(3);
  });
});

describe("canopy field colours (two-tone split + core darkening)", () => {
  // One 9×9 crown; depthOf/colours from the real palette pipeline.
  const layers = [block("terrain:canopy", 0, 0, 8, 8)];
  const built = buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN)!;
  const field = createTerrainField(built.config);
  const at = (cx: number, cy: number) => field.colorAt((cx + 0.5) * SIZE, (cy + 0.5) * SIZE)!;

  it("the up-right (sun) half reads lighter than the down-left (shade) half", () => {
    // Averages beat the boundary jitter; both bands sit at similar crown
    // depth so the core darkening cancels out of the comparison.
    const sun = [at(6, 2), at(5, 2), at(6, 3), at(7, 2), at(5, 1)];
    const shade = [at(2, 6), at(3, 6), at(2, 5), at(1, 6), at(3, 7)];
    const mean = (colors: [number, number, number][]) =>
      colors.reduce((total, c) => total + luma(c), 0) / colors.length;
    expect(mean(sun)).toBeGreaterThan(mean(shade) + 8);
  });

  it("the crown centre is darker than its own side's rim band", () => {
    // Two probes on the same (shade) side so the sun split cancels: the
    // deep centre must sink toward `core` versus the near-edge cell.
    const centre = at(4, 4);
    const nearEdge = at(1, 7);
    expect(luma(centre)).toBeLessThan(luma(nearEdge));
  });
});

describe("canopy sub-lobe octave (two-scale scallops)", () => {
  const families = (sub: number): TerrainFieldConfig => ({
    familyAt: (cx, cy) => (cx >= 0 && cx <= 4 && cy >= 0 && cy <= 4 ? "c" : null),
    families: [
      {
        assetId: "c",
        priority: 1,
        base: "#5e8f30",
        rim: "#1b3517",
        edgeAmp: 1.3,
        canopy: { shade: "#2f5d24", core: "#1f4520", sub },
      },
    ],
    cellSize: SIZE,
    originX: 0,
    originY: 0,
  });

  it("sub > 0 displaces the boundary versus sub 0, and only near the edge", () => {
    const wavy = createTerrainField(families(0.5));
    const flat = createTerrainField(families(0));
    let boundaryDiffers = false;
    for (let i = 0; i < 200 && !boundaryDiffers; i += 1) {
      const wx = (i / 200) * 5 * SIZE;
      const wy = 2; // along the top edge, where prox ≈ 1
      if (Math.abs(wavy.sampleField("c", wx, wy) - flat.sampleField("c", wx, wy)) > 1e-9) {
        boundaryDiffers = true;
      }
    }
    expect(boundaryDiffers).toBe(true);
    // Solid interior (prox → 0): the octave must not eat into the crown.
    const cx = 2.5 * SIZE;
    expect(wavy.sampleField("c", cx, cx)).toBeCloseTo(flat.sampleField("c", cx, cx), 6);
  });
});

describe("paintCanopyDetail (leaf ticks + edge highlights)", () => {
  const paint = (cellX: number, cellY: number, depth: number) => {
    const { context, calls } = createRecordingContext();
    paintCanopyDetail(
      context as never,
      cellRect(cellX, cellY),
      { detail: LEAF_CANOPY_DETAIL },
      depth,
    );
    return calls;
  };

  it("is deterministic, in-bounds, and draws both tick tones", () => {
    expect(paint(3, 4, 1)).toEqual(paint(3, 4, 1));
    const seen = new Set<string>();
    for (let cx = 0; cx < 6; cx += 1) {
      for (const call of paint(cx, 2, 1)) {
        if (call[0] === "set:fillStyle") seen.add(call[1] as string);
        if (call[0] === "fillRect") {
          const [, x, y, w, h] = call as [string, number, number, number, number];
          expect(x).toBeGreaterThanOrEqual(cx * SIZE);
          expect(y).toBeGreaterThanOrEqual(2 * SIZE);
          expect(x + w).toBeLessThanOrEqual((cx + 1) * SIZE);
          expect(y + h).toBeLessThanOrEqual(3 * SIZE);
        }
      }
    }
    expect(seen).toContain(LEAF_CANOPY_DETAIL.tickLight);
    expect(seen).toContain(LEAF_CANOPY_DETAIL.tickDark);
  });

  it("highlights appear on silhouette cells and never past the depth gate", () => {
    const highlightAt = (depth: number): boolean => {
      for (let cx = 0; cx < 12; cx += 1) {
        const used = paint(cx, 9, depth)
          .filter(([op]) => op === "set:fillStyle")
          .map(([, v]) => v as string);
        if (used.includes(LEAF_CANOPY_DETAIL.highlight)) return true;
      }
      return false;
    };
    expect(highlightAt(0)).toBe(true);
    expect(highlightAt(CANOPY_HIGHLIGHT_MAX_DEPTH + 0.5)).toBe(false);
  });
});
