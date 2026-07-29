// LIVE-BAKED brush thumbnails: each paint family rendered once by the REAL
// painter stack (bakeProceduralTerrain) over a 3×3 cell patch, cropped to the
// interior and cached as data URLs (44px tile + 120px hover preview from one
// bake). Bakes are idle-scheduled one family at a time so opening the deck
// never blocks; the flat asset `fill` is the loading fallback, and an
// environment without a 2D canvas (tests) simply keeps the fallback.

import { NEIGHBOR_BITS } from "../render/blobAutotile";
import { bakeProceduralTerrain } from "../render/proceduralTerrainSurface";
import { VILLAGE_SHADOW_TINT, VILLAGE_TERRAIN } from "../render/terrainPalette";
import type { StructuredTerrainLayer, TerrainCellRect } from "../render/tileRenderCore";

export const BRUSH_THUMB_SIZE = 44;
export const BRUSH_PREVIEW_SIZE = 120;
const PATCH_CELLS = 3;
/** Bake once at preview scale; the 44px tile is a downscale of the same art. */
const CELL = BRUSH_PREVIEW_SIZE / PATCH_CELLS;

export interface BrushThumbnail {
  /** 44×44 data URL for the deck tile. */
  thumb: string;
  /** 120×120 data URL for the hover card. */
  preview: string;
}

/**
 * The 3×3 single-family patch handed to the bake, with the same 8-neighbour
 * masks buildStructuredTerrainLayers would emit (the wall painter's
 * run-vs-quoin choice reads them). Exported for tests.
 */
export function thumbnailPatchLayers(assetId: string): StructuredTerrainLayer[] {
  const inPatch = (x: number, y: number) => x >= 0 && x < PATCH_CELLS && y >= 0 && y < PATCH_CELLS;
  const cells: TerrainCellRect[] = [];
  for (let cy = 0; cy < PATCH_CELLS; cy++) {
    for (let cx = 0; cx < PATCH_CELLS; cx++) {
      let neighborMask = 0;
      if (inPatch(cx, cy - 1)) neighborMask |= NEIGHBOR_BITS.N;
      if (inPatch(cx + 1, cy - 1)) neighborMask |= NEIGHBOR_BITS.NE;
      if (inPatch(cx + 1, cy)) neighborMask |= NEIGHBOR_BITS.E;
      if (inPatch(cx + 1, cy + 1)) neighborMask |= NEIGHBOR_BITS.SE;
      if (inPatch(cx, cy + 1)) neighborMask |= NEIGHBOR_BITS.S;
      if (inPatch(cx - 1, cy + 1)) neighborMask |= NEIGHBOR_BITS.SW;
      if (inPatch(cx - 1, cy)) neighborMask |= NEIGHBOR_BITS.W;
      if (inPatch(cx - 1, cy - 1)) neighborMask |= NEIGHBOR_BITS.NW;
      cells.push({ x: cx * CELL, y: cy * CELL, size: CELL, cellX: cx, cellY: cy, neighborMask });
    }
  }
  return [{ assetId, cells, edges: [] }];
}

/** Crop the patch interior (world 0..PREVIEW) out of the margin-padded bake. */
function cropToDataUrl(
  source: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  outSize: number,
): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(
    source,
    sourceX,
    sourceY,
    BRUSH_PREVIEW_SIZE,
    BRUSH_PREVIEW_SIZE,
    0,
    0,
    outSize,
    outSize,
  );
  return canvas.toDataURL();
}

function bakeFamily(assetId: string): BrushThumbnail | null {
  const baked = bakeProceduralTerrain({
    terrainLayers: thumbnailPatchLayers(assetId),
    grid: { size: CELL, offsetX: 0, offsetY: 0 },
    palette: VILLAGE_TERRAIN,
    shadowTint: VILLAGE_SHADOW_TINT,
  });
  if (!baked) return null;
  const preview = cropToDataUrl(baked.canvas, -baked.originX, -baked.originY, BRUSH_PREVIEW_SIZE);
  const thumb = cropToDataUrl(baked.canvas, -baked.originX, -baked.originY, BRUSH_THUMB_SIZE);
  return preview && thumb ? { thumb, preview } : null;
}

// --- Cache + idle bake queue ------------------------------------------------

type CacheEntry = BrushThumbnail | "pending" | "failed";
const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();
const queue: string[] = [];
let scheduled = false;
let version = 0;

const scheduleIdle = (run: () => void): void => {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 500 });
  } else {
    setTimeout(run, 16);
  }
};

function pump(): void {
  if (scheduled || queue.length === 0) return;
  scheduled = true;
  scheduleIdle(() => {
    scheduled = false;
    const next = queue.shift();
    if (next !== undefined) {
      let result: BrushThumbnail | null = null;
      try {
        result = bakeFamily(next);
      } catch {
        result = null;
      }
      cache.set(next, result ?? "failed");
      version++;
      for (const listener of [...listeners]) listener();
    }
    pump();
  });
}

/** The baked thumbnail if it exists — never queues work (render-safe). */
export function peekBrushThumbnail(assetId: string): BrushThumbnail | null {
  const entry = cache.get(assetId);
  return entry === undefined || entry === "pending" || entry === "failed" ? null : entry;
}

/** Queue any un-baked families; results land via the subscription. */
export function requestBrushThumbnails(assetIds: readonly string[]): void {
  for (const assetId of assetIds) {
    if (!cache.has(assetId)) {
      cache.set(assetId, "pending");
      queue.push(assetId);
    }
  }
  pump();
}

/** Bump-on-every-bake counter for useSyncExternalStore. */
export function getBrushThumbnailVersion(): number {
  return version;
}

export function subscribeBrushThumbnails(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test hook: forget every bake and pending request. */
export function __resetBrushThumbnailsForTests(): void {
  cache.clear();
  queue.length = 0;
  version = 0;
}
