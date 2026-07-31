// TEMPORARY review benchmark — measures the Water II per-pixel cost delta.
// Never committed. Opt-in via PERF_BENCH=1 — a full-map bake takes ~2 minutes,
// which is far too slow to ride every default vitest run.
import { describe, it } from "vitest";

const RUN_BENCH = process.env.PERF_BENCH === "1";
import { renderTerrainField, type TerrainFieldConfig } from "../proceduralTerrain";
import { computeBodyDepths } from "../terrainDistanceField";
import { VILLAGE_TERRAIN } from "../terrainPalette";

const CELLS = 100;
const CELL_SIZE = 50;

function buildConfig(withKnobs: boolean): { config: TerrainFieldConfig; w: number; h: number } {
  const water = VILLAGE_TERRAIN["terrain:water"]!;
  const familyByCell = new Map<string, string>();
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      familyByCell.set(`${cx},${cy}`, "terrain:water");
    }
  }
  const depths = computeBodyDepths(familyByCell, ["terrain:water"]);
  const fam = {
    assetId: "terrain:water",
    priority: water.priority,
    base: water.base,
    rim: water.rim,
    edgeAmp: water.edgeAmp,
    rimWidth: water.rimWidth,
    mottle: water.mottle,
    depthBands: water.depthBands,
    underfill: water.underfill,
    ...(withKnobs ? { foam: water.foam, caustics: water.caustics } : {}),
  };
  const margin = 1;
  const config: TerrainFieldConfig = {
    familyAt: (cx, cy) => familyByCell.get(`${cx},${cy}`) ?? null,
    families: [fam],
    cellSize: CELL_SIZE,
    originX: -margin * CELL_SIZE,
    originY: -margin * CELL_SIZE,
    offsetX: 0,
    offsetY: 0,
    depthOf: (assetId, cx, cy) => depths.get(assetId)?.get(`${cx},${cy}`) ?? 0,
  };
  const w = (CELLS + 2 * margin) * CELL_SIZE;
  const h = (CELLS + 2 * margin) * CELL_SIZE;
  return { config, w, h };
}

function timeBake(withKnobs: boolean): number {
  const { config, w, h } = buildConfig(withKnobs);
  const buffer = new Uint8ClampedArray(w * h * 4);
  const t0 = performance.now();
  renderTerrainField(buffer, w, h, config);
  return performance.now() - t0;
}

describe.skipIf(!RUN_BENCH)("perf bench (temporary)", () => {
  it("measures knobs-off vs knobs-on bake time", () => {
    // Warm-up on a small size so JIT tiers up before timing.
    timeBake(false);
    timeBake(true);
    const off1 = timeBake(false);
    const on1 = timeBake(true);
    const off2 = timeBake(false);
    const on2 = timeBake(true);
    const px = (CELLS + 2) * CELL_SIZE * (CELLS + 2) * CELL_SIZE;
    console.log(
      `pixels=${px}  knobs-off: ${off1.toFixed(0)}ms / ${off2.toFixed(0)}ms  ` +
        `knobs-on: ${on1.toFixed(0)}ms / ${on2.toFixed(0)}ms  ` +
        `(per-px off ${((Math.min(off1, off2) * 1e6) / px).toFixed(1)}ns, ` +
        `on ${((Math.min(on1, on2) * 1e6) / px).toFixed(1)}ns)`,
    );
  }, 600_000);
});
