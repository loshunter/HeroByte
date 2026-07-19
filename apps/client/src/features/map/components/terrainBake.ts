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
 * The layers whose family belongs to the water BODY — the depth-banded water
 * plus its drowned (sunken) structures. The shimmer treats them as ONE
 * surface: without this, a drowned slab read as shore through the
 * same-assetId neighbor mask and punched a static hole in the animated water
 * around every ruin (confirmed review finding, Water II).
 */
export function waterBodyLayers(
  layers: readonly StructuredTerrainLayer[],
): StructuredTerrainLayer[] {
  return layers.filter((layer) => {
    const fam = VILLAGE_TERRAIN[layer.assetId];
    return fam !== undefined && ((fam.depthBands?.length ?? 0) > 0 || fam.sunken !== undefined);
  });
}

/**
 * The 4-frame water shimmer over the STATIC baked bathymetry: a low-alpha
 * animated wash on interior BODY cells only (all 8 neighbours inside the
 * water∪sunken occupancy), so the organic baked shoreline never shows square
 * tint edges while the surface still animates across drowned architecture.
 * Frame 0 draws nothing — reduced motion and the static export read the pure
 * bake. Pass the full body (waterBodyLayers), not a single family's cells.
 */
export function drawWaterShimmer(
  ctx: CanvasRenderingContext2D,
  layers: readonly StructuredTerrainLayer[],
  frames: readonly string[],
  frame: number,
): void {
  if (frame <= 0 || frames.length === 0) return;
  const body = new Set<string>();
  for (const layer of layers) {
    for (const cell of layer.cells) body.add(`${cell.cellX},${cell.cellY}`);
  }
  const interior = (cellX: number, cellY: number): boolean => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((dx !== 0 || dy !== 0) && !body.has(`${cellX + dx},${cellY + dy}`)) return false;
      }
    }
    return true;
  };
  const fill = frames[frame % frames.length]!;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = fill;
  for (const layer of layers) {
    for (const cell of layer.cells) {
      if (interior(cell.cellX, cell.cellY)) ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
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
