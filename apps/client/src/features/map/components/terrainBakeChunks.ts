// Pure band-planning helpers for the chunked worker bake (P3). The worker
// renders the field in horizontal bands so painterly detail streams onto the
// table instead of blocking it; these functions are DOM-free and shared with
// tests, which pin the banded output byte-identical to the whole-field bake.

import type { StructuredTerrainLayer } from "../../render/tileRenderCore";

export interface BakeBand {
  /** Band top, in px from the bake buffer's top edge. */
  top: number;
  height: number;
}

/** ~this many pixels per band: big enough to be worth a message round-trip,
 * small enough that progress moves and a superseding job interrupts fast. */
const TARGET_BAND_PIXELS = 600_000;

/** Split a bake buffer into horizontal bands of roughly equal pixel count. */
export function planBakeBands(width: number, height: number): BakeBand[] {
  const bandHeight = Math.max(
    64,
    Math.min(1024, Math.round(TARGET_BAND_PIXELS / Math.max(1, width))),
  );
  const bands: BakeBand[] = [];
  for (let top = 0; top < height; top += bandHeight) {
    bands.push({ top, height: Math.min(bandHeight, height - top) });
  }
  return bands;
}

/**
 * Layers narrowed to the cells that can paint into a band (±1 cell margin —
 * the detail painters are cell-local, and the band context clips the exact
 * edges so a margin cell only lands its in-band pixels). Cell-empty layers
 * drop entirely so the detail pass skips them. Band bounds are WORLD px.
 */
export function bandLayers(
  layers: readonly StructuredTerrainLayer[],
  bandTopWorld: number,
  bandBottomWorld: number,
  cellSize: number,
): StructuredTerrainLayer[] {
  const margin = cellSize;
  return layers
    .map((layer) => ({
      ...layer,
      cells: layer.cells.filter(
        (cell) => cell.y + cell.size >= bandTopWorld - margin && cell.y <= bandBottomWorld + margin,
      ),
    }))
    .filter((layer) => layer.cells.length > 0);
}
