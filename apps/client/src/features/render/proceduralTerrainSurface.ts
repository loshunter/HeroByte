// Procedural terrain SURFACE — the orchestrator that turns painted terrain into
// a baked, blit-ready image. It frames the painted grass/dirt/path cells, renders
// the bumpy base/rim/shadow field (proceduralTerrain) into an offscreen canvas,
// then layers the interior detail on top clipped to the field so pebbles/blades
// stay on the right side of every organic seam — the v2 prototype's two-pass
// recipe (temp/_dirt_path_proto/transition_v2_proto.mjs).
//
// Field families are those the palette knows: the natural grass/dirt/path
// terrain plus the architectural wood/stone floors (crisp edges via a per-family
// edgeAmp). Water is NOT baked here — the field leaves it transparent and the
// caller draws it on its own layer, so its z-order and animation are untouched.
// The bake is heavy per pixel, so callers cache the returned canvas and re-bake
// only when the terrain content changes.

import {
  createTerrainField,
  renderTerrainField,
  TERRAIN_RIM,
  type TerrainField,
  type TerrainFieldConfig,
  type TerrainFieldFamily,
} from "./proceduralTerrain";
import { computeShoreDistances } from "./terrainDistanceField";
import { applyBakeLighting, lightingActive, type BakeLighting } from "./terrainLighting";
import { paintKeyClusterDetail, paintTerrainDetail } from "./terrainDetail";
import { paintFloorDetail } from "./terrainFloorDetail";
import { paintRoofDetail, paintStairsDetail } from "./terrainRoofDetail";
import { paintWallDetail } from "./terrainWallDetail";
import type { TerrainFamilyPalette } from "./terrainPalette";
import type {
  StructuredTerrainLayer,
  TerrainCellRect,
  TileRenderContext2D,
} from "./tileRenderCore";

/** Per-family palette keyed by terrain assetId (e.g. VILLAGE_TERRAIN). */
export type TerrainPalette = Record<string, TerrainFamilyPalette>;

/** The grid slice the surface needs: cell size and lattice origin. */
export interface ProceduralGrid {
  size: number;
  offsetX: number;
  offsetY: number;
}

export interface ProceduralTerrainInput {
  terrainLayers: readonly StructuredTerrainLayer[];
  grid: ProceduralGrid;
  palette: TerrainPalette;
  /** Ambient veil + light pools applied over the finished bake (terrainLighting). */
  lighting?: BakeLighting;
}

/** The field config plus the doc-space buffer dimensions to bake it into. */
export interface BuiltProceduralField {
  config: TerrainFieldConfig;
  width: number;
  height: number;
}

/** A baked terrain image and where its top-left sits in world coordinates. */
export interface BakedProceduralTerrain {
  canvas: HTMLCanvasElement;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Extra cells around the painted bbox so outward bumps (grass-vs-empty) and
 * cast shadows have room to bleed without being clipped. */
const FIELD_MARGIN_CELLS = 1;

/**
 * Frame the painted FIELD cells (those the palette covers) into a field config
 * and a doc-space buffer size, or null when nothing in this terrain is a field
 * family. Non-field families (water) are skipped — they render on their own
 * layers.
 */
export function buildProceduralFieldConfig(
  terrainLayers: readonly StructuredTerrainLayer[],
  grid: ProceduralGrid,
  palette: TerrainPalette,
): BuiltProceduralField | null {
  const familyByCell = new Map<string, string>();
  const families: TerrainFieldFamily[] = [];
  let minCX = Infinity;
  let minCY = Infinity;
  let maxCX = -Infinity;
  let maxCY = -Infinity;
  for (const layer of terrainLayers) {
    const fam = palette[layer.assetId];
    if (!fam) continue; // non-field family — rendered elsewhere
    families.push({
      assetId: layer.assetId,
      priority: fam.priority,
      base: fam.base,
      rim: fam.rim,
      edgeAmp: fam.edgeAmp,
      rimWidth: fam.rimWidth,
      shadow: fam.shadow,
      mottle: fam.mottle,
      depthBands: fam.depthBands,
      underfill: fam.underfill,
      contact: fam.contact,
    });
    for (const cell of layer.cells) {
      familyByCell.set(`${cell.cellX},${cell.cellY}`, layer.assetId);
      if (cell.cellX < minCX) minCX = cell.cellX;
      if (cell.cellX > maxCX) maxCX = cell.cellX;
      if (cell.cellY < minCY) minCY = cell.cellY;
      if (cell.cellY > maxCY) maxCY = cell.cellY;
    }
  }
  if (familyByCell.size === 0) return null;
  // Shore-distance transforms for the depth-banded families (water): one BFS
  // per family over the occupancy this builder already gathered.
  const depths = new Map<string, Map<string, number>>();
  for (const family of families) {
    if (!family.depthBands || family.depthBands.length === 0) continue;
    const own = new Set<string>();
    for (const [cellKey, id] of familyByCell) {
      if (id === family.assetId) own.add(cellKey);
    }
    depths.set(family.assetId, computeShoreDistances(own));
  }
  const { size, offsetX, offsetY } = grid;
  const margin = FIELD_MARGIN_CELLS;
  const config: TerrainFieldConfig = {
    familyAt: (cx, cy) => familyByCell.get(`${cx},${cy}`) ?? null,
    families,
    cellSize: size,
    originX: offsetX + (minCX - margin) * size,
    originY: offsetY + (minCY - margin) * size,
    offsetX,
    offsetY,
    depthOf: (assetId, cx, cy) => depths.get(assetId)?.get(`${cx},${cy}`) ?? 0,
  };
  return {
    config,
    width: (maxCX - minCX + 1 + 2 * margin) * size,
    height: (maxCY - minCY + 1 + 2 * margin) * size,
  };
}

/**
 * Wrap a context so only fillRects whose CENTRE passes `keep` reach it — the
 * clip that keeps interior detail on the right side of a bumpy seam. The detail
 * painters (paintTerrainDetail / paintKeyClusterDetail) touch only `fillStyle`
 * and `fillRect`, so this reuses them verbatim instead of forking their math.
 */
export function makeClipCtx(
  real: TileRenderContext2D,
  keep: (worldX: number, worldY: number) => boolean,
): TileRenderContext2D {
  return {
    get fillStyle() {
      return real.fillStyle;
    },
    set fillStyle(value) {
      real.fillStyle = value;
    },
    get strokeStyle() {
      return real.strokeStyle;
    },
    set strokeStyle(value) {
      real.strokeStyle = value;
    },
    get lineWidth() {
      return real.lineWidth;
    },
    set lineWidth(value) {
      real.lineWidth = value;
    },
    get globalAlpha() {
      return real.globalAlpha;
    },
    set globalAlpha(value) {
      real.globalAlpha = value;
    },
    get imageSmoothingEnabled() {
      return real.imageSmoothingEnabled;
    },
    set imageSmoothingEnabled(value) {
      real.imageSmoothingEnabled = value;
    },
    fillRect(x, y, w, h) {
      if (keep(x + w / 2, y + h / 2)) real.fillRect(x, y, w, h);
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    save() {},
    restore() {},
    drawImage() {},
  };
}

function paintFamilyDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  assetId: string,
  palette: TerrainPalette,
): void {
  const fam = palette[assetId];
  if (fam?.wall) paintWallDetail(ctx, cell, fam.wall);
  else if (fam?.roof) paintRoofDetail(ctx, cell, fam.roof);
  else if (fam?.stairs) paintStairsDetail(ctx, cell, fam.stairs);
  else if (fam?.floor) paintFloorDetail(ctx, cell, fam.floor);
  else if (fam?.keyCluster) paintKeyClusterDetail(ctx, cell, fam.keyCluster);
  else paintTerrainDetail(ctx, cell, assetId);
}

/** The most common lower-priority von-Neumann neighbour of a cell, or null. */
function dominantLowerNeighbour(
  familyAt: (cx: number, cy: number) => string | null,
  cellX: number,
  cellY: number,
  priority: number,
  palette: TerrainPalette,
): string | null {
  const lower = [
    familyAt(cellX, cellY - 1),
    familyAt(cellX + 1, cellY),
    familyAt(cellX, cellY + 1),
    familyAt(cellX - 1, cellY),
  ].filter((id): id is string => id !== null && (palette[id]?.priority ?? 0) < priority);
  if (lower.length === 0) return null;
  let best = lower[0]!;
  let bestCount = 0;
  // `>=` breaks ties toward the LAST neighbour in [N, E, S, W] order, matching
  // the validated prototype (an ascending stable sort + `.pop()`), so the same
  // seam gets decorated as the reference render.
  for (const id of lower) {
    const count = lower.filter((z) => z === id).length;
    if (count >= bestCount) {
      bestCount = count;
      best = id;
    }
  }
  return best;
}

/**
 * Layer interior detail over the baked field (world coords; caller has already
 * translated the context to the buffer origin). Per cell: its own detail clipped
 * to where the family sits on top (field ≥ RIM), then the dominant lower
 * neighbour's detail in the exposed transition band (this family receded,
 * field < 0, but the lower family present, field ≥ 0) so pebbles reach the seam.
 */
export function paintProceduralDetail(
  ctx: TileRenderContext2D,
  fieldLayers: readonly StructuredTerrainLayer[],
  palette: TerrainPalette,
  field: TerrainField,
  familyAt: (cx: number, cy: number) => string | null,
): void {
  for (const layer of fieldLayers) {
    const fam = palette[layer.assetId];
    if (!fam) continue;
    // Clip own detail past the family's OWN rim width (walls use a thin lip).
    const rim = fam.rimWidth ?? TERRAIN_RIM;
    for (const cell of layer.cells) {
      const ownCtx = makeClipCtx(ctx, (wx, wy) => field.sampleField(layer.assetId, wx, wy) >= rim);
      paintFamilyDetail(ownCtx, cell, layer.assetId, palette);

      const under = dominantLowerNeighbour(familyAt, cell.cellX, cell.cellY, fam.priority, palette);
      if (under) {
        const underCtx = makeClipCtx(
          ctx,
          (wx, wy) =>
            field.sampleField(layer.assetId, wx, wy) < 0 && field.sampleField(under, wx, wy) >= 0,
        );
        paintFamilyDetail(underCtx, cell, under, palette);
      }
    }
  }
}

/** Per-bake ceiling. A sparse or very large field can inflate the bounding box
 * to document scale, and the buffer + canvas are each width*height*4 bytes.
 * Past this, skip the procedural bake (the caller falls back to the flat/atlas
 * core render) rather than throw a RangeError or exceed the browser's max canvas
 * area — which renders blank. Chunked / at-publish bakes (Slice 4) lift this. */
const MAX_BAKE_DIM = 8192; // browser max canvas dimension is ~8k on many GPUs
const MAX_BAKE_PIXELS = 32_000_000; // ~128 MB buffer + ~128 MB canvas per bake

/**
 * Bake the painted field families into an offscreen canvas (base/rim/shadow
 * field + clipped interior detail), returning it and its world placement. Null
 * when there is no field terrain OR the field is too large to bake (see the cap
 * above). Heavy per pixel — cache the result and re-bake only when the terrain
 * content changes.
 */
export function bakeProceduralTerrain(
  input: ProceduralTerrainInput,
): BakedProceduralTerrain | null {
  const { terrainLayers, grid, palette } = input;
  const built = buildProceduralFieldConfig(terrainLayers, grid, palette);
  if (!built) return null;
  const { config, width, height } = built;

  if (width > MAX_BAKE_DIM || height > MAX_BAKE_DIM || width * height > MAX_BAKE_PIXELS) {
    console.warn(
      `[proceduralTerrain] field bbox ${width}×${height}px exceeds the bake cap ` +
        `(${MAX_BAKE_DIM}px/side, ${MAX_BAKE_PIXELS}px total); ` +
        `falling back to the flat core render.`,
    );
    return null;
  }

  const buffer = new Uint8ClampedArray(width * height * 4);
  renderTerrainField(buffer, width, height, config);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ImageData(buffer, width, height), 0, 0);

  // Detail pass in world coords: shift so world (originX, originY) → (0, 0).
  ctx.save();
  ctx.translate(-config.originX, -config.originY);
  const field = createTerrainField(config);
  const fieldLayers = terrainLayers.filter((layer) => palette[layer.assetId]);
  paintProceduralDetail(ctx, fieldLayers, palette, field, config.familyAt);
  ctx.restore();

  // Lighting post-pass (ambient veil + pools) over the finished art. Daylight
  // with no lights skips it entirely, so unlit maps bake bit-identically.
  if (lightingActive(input.lighting)) {
    const lit = ctx.getImageData(0, 0, width, height);
    applyBakeLighting(lit.data, width, height, config.originX, config.originY, input.lighting!);
    ctx.putImageData(lit, 0, 0);
  }

  return { canvas, originX: config.originX, originY: config.originY, width, height };
}
