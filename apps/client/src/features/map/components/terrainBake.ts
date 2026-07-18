// Field-terrain bake cache for the live table. Grass/dirt/path (and the
// procedural floors) render as a bumpy procedural field baked to an offscreen
// canvas ONCE per terrain edit; the remaining families (e.g. animated water)
// keep the flat/atlas core path. Ported from the Map Studio editor underlay so
// live-authored terrain looks identical to the Studio and exports.
//
// Kept out of TerrainLayer (and out of the Konva sceneFunc, which runs per
// frame) so the expensive bake happens only when the terrain layers or grid
// change — the cache key discipline.

import {
  bakeProceduralTerrain,
  type BakedProceduralTerrain,
  type ProceduralGrid,
} from "../../render/proceduralTerrainSurface";
import type { BakeLighting } from "../../render/terrainLighting";
import { VILLAGE_TERRAIN } from "../../render/terrainPalette";
import type { StructuredTerrainLayer } from "../../render/tileRenderCore";

export interface FieldBakeCache {
  source: readonly StructuredTerrainLayer[] | null;
  gridSig: string;
  lightingSig: string;
  baked: BakedProceduralTerrain | null;
}

export function createFieldBakeCache(): FieldBakeCache {
  return { source: null, gridSig: "", lightingSig: "", baked: null };
}

/**
 * Return the cached field bake, re-baking ONLY when the terrain layers
 * identity, the grid signature, or the lighting state changes — never per
 * animation frame. Returns null when there is no field terrain, or the field
 * is too large to bake (the caller must then fall back to the flat/atlas core
 * render so terrain never vanishes).
 */
export function getFieldBake(
  cache: FieldBakeCache,
  layers: readonly StructuredTerrainLayer[],
  grid: ProceduralGrid,
  lighting?: BakeLighting,
): BakedProceduralTerrain | null {
  const gridSig = `${grid.size}|${grid.offsetX}|${grid.offsetY}`;
  // Lighting is tiny (an ambient + a handful of lights), so a JSON signature
  // keyed by VALUE keeps snapshot-identity churn from re-running the bake.
  const lightingSig = lighting ? JSON.stringify(lighting) : "";
  if (cache.source !== layers || cache.gridSig !== gridSig || cache.lightingSig !== lightingSig) {
    cache.source = layers;
    cache.gridSig = gridSig;
    cache.lightingSig = lightingSig;
    cache.baked = bakeProceduralTerrain({
      terrainLayers: layers,
      grid,
      palette: VILLAGE_TERRAIN,
      lighting,
    });
  }
  return cache.baked;
}

/**
 * The terrain layers that must still draw through the flat/atlas core: when the
 * field baked, only the NON-field families (they draw OVER the baked field,
 * preserving z-order); when it did not bake, ALL layers (the fallback).
 */
export function coreTerrainLayers(
  layers: readonly StructuredTerrainLayer[],
  baked: BakedProceduralTerrain | null,
): readonly StructuredTerrainLayer[] {
  return baked ? layers.filter((layer) => !VILLAGE_TERRAIN[layer.assetId]) : layers;
}

/**
 * The 4-frame water shimmer over the STATIC baked bathymetry: a low-alpha
 * animated wash on interior water cells only (all 8 neighbours water, via the
 * neighbor mask), so the organic baked shoreline never shows square tint
 * edges. Frame 0 draws nothing — reduced motion and the static export read the
 * pure bake.
 */
export function drawWaterShimmer(
  ctx: CanvasRenderingContext2D,
  layers: readonly StructuredTerrainLayer[],
  frames: readonly string[],
  frame: number,
): void {
  if (frame <= 0 || frames.length === 0) return;
  const fill = frames[frame % frames.length]!;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = fill;
  for (const layer of layers) {
    for (const cell of layer.cells) {
      if ((cell.neighborMask ?? 0) === 255) ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
    }
  }
  ctx.globalAlpha = previousAlpha;
}

/** Blit a baked field onto a table context at its world origin, pixels crisp. */
export function blitFieldBake(ctx: CanvasRenderingContext2D, baked: BakedProceduralTerrain): void {
  const previousSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false; // crisp pixels; no bilinear seam bleed
  ctx.drawImage(
    baked.canvas,
    0,
    0,
    baked.width,
    baked.height,
    baked.originX,
    baked.originY,
    baked.width,
    baked.height,
  );
  ctx.imageSmoothingEnabled = previousSmoothing;
}
