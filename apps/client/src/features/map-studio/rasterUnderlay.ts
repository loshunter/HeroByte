// Raster-export compositor (R4b): the PNG/WebP path draws the document
// background, grid, and atlas-textured terrain onto a 2D context through the
// shared tile-render core, then the caller blits the elements-only SVG on top.
// This is the editor underlay's composition without a camera — the export
// renders the whole document 1:1 at frame 0 (no shimmer baked into a still).
// The SVG download deliberately stays flat-color and byte-stable; only the
// raster path sources atlas textures, which cannot ride inside a portable SVG.
import type { MapDocument } from "@herobyte/shared";
import { drawGrid } from "../render/gridRenderCore";
import { paintTerrainDetail } from "../render/terrainDetail";
import {
  drawTerrain,
  type StructuredTerrainLayer,
  type TerrainAtlasSource,
  type TerrainDrawOptions,
} from "../render/tileRenderCore";
import { bakeProceduralTerrain } from "../render/proceduralTerrainSurface";
import { VILLAGE_TERRAIN } from "../render/terrainPalette";
import { getGridGeometry } from "./gridGeometry";
import { terrainStyleForFrame } from "./starterTiles";

/** Document background, matching the SVG export's `<rect fill="#24212b"/>`. */
const DOCUMENT_FILL = "#24212b";
/** A still renders the base animation frame — no water shimmer in an export. */
const EXPORT_FRAME = 0;

/**
 * Paint the export's background, grid, and terrain into a document-space 2D
 * context (identity transform, canvas sized to the document). Grid uses the
 * shared core's export defaults (#ffffff at 0.16 alpha) so it matches the SVG
 * pattern; terrain textures through the atlas when one is supplied and falls
 * back to flat family fills when it is null (a missing atlas must never fail
 * the export). The terrain-kind layer's opacity is honored the way the SVG
 * export applies it — per family group, flattened then faded.
 */
export function paintRasterUnderlay(
  ctx: CanvasRenderingContext2D,
  document: MapDocument,
  terrainLayers: readonly StructuredTerrainLayer[],
  atlas: TerrainAtlasSource | null,
): void {
  const { width, height, grid } = document;
  const view = { x: 0, y: 0, width, height };

  ctx.fillStyle = DOCUMENT_FILL;
  ctx.fillRect(0, 0, width, height);

  if (grid.visible) {
    // The full grid geometry (square/hex/iso) matches the SVG export's
    // <pattern>. One sub-pixel gap remains: a hex tile's flat top and bottom
    // edges stack onto the same world line, so the shared core strokes it as
    // two overlapping half-width segments where the SVG's pattern-clipping
    // unions two complementary halves into a full-width line — hex horizontals
    // read slightly thin. The byte-stable SVG download is the full-fidelity
    // grid; square terrain maps (the common case) are unaffected.
    const geometry = getGridGeometry(grid.type, grid.size);
    drawGrid(
      ctx,
      {
        width: geometry.width,
        height: geometry.height,
        path: geometry.path,
        offsetX: grid.offsetX,
        offsetY: grid.offsetY,
      },
      view,
    );
  }

  const opacity = terrainLayerOpacity(document);
  if (opacity <= 0 || terrainLayers.length === 0) return;

  // Grass/dirt/path bake as the procedural bumpy field (same look the editor
  // shows); water/stone/wood keep the flat/atlas core path. When the field can't
  // bake — no field families, or over the size cap — the core renders every
  // layer, so terrain never vanishes from a download.
  const baked = bakeProceduralTerrain({ terrainLayers, grid, palette: VILLAGE_TERRAIN });
  const coreLayers = baked
    ? terrainLayers.filter((layer) => !VILLAGE_TERRAIN[layer.assetId])
    : terrainLayers;
  const options: TerrainDrawOptions = { atlas: atlas ?? undefined, detail: paintTerrainDetail };

  const paint = (target: CanvasRenderingContext2D): void => {
    if (baked) {
      const previousSmoothing = target.imageSmoothingEnabled;
      target.imageSmoothingEnabled = false; // crisp pixels; no bilinear seam bleed
      target.drawImage(
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
      target.imageSmoothingEnabled = previousSmoothing;
    }
    if (coreLayers.length > 0) {
      drawTerrain(target, coreLayers, terrainStyleForFrame, EXPORT_FRAME, view, options);
    }
  };

  if (opacity >= 1) {
    paint(ctx);
    return;
  }
  paintFadedTerrain(ctx, document, paint, opacity);
}

/** The terrain-kind layer's opacity, or 0 when hidden — mirrors renderTerrain. */
function terrainLayerOpacity(document: MapDocument): number {
  const layer = document.layers.find((candidate) => candidate.kind === "terrain");
  if (layer && (!layer.visible || layer.opacity <= 0)) return 0;
  return layer?.opacity ?? 1;
}

/**
 * Flatten the whole terrain group opaquely on an offscreen canvas, then blit it
 * once at the layer alpha — matching the SVG's per-`<g>` group opacity without
 * per-primitive globalAlpha, which would tint boundary strokes with the fill
 * beneath them (the editor underlay carries the same reasoning). `paint` draws
 * the field blit plus the core families opaquely into whatever context it's given.
 */
function paintFadedTerrain(
  ctx: CanvasRenderingContext2D,
  document: MapDocument,
  paint: (target: CanvasRenderingContext2D) => void,
  opacity: number,
): void {
  const offscreen = window.document.createElement("canvas");
  offscreen.width = document.width;
  offscreen.height = document.height;
  const offscreenCtx = offscreen.getContext("2d");
  if (!offscreenCtx) {
    // No offscreen surface: best-effort single fade rather than dropping the
    // terrain entirely (strokes may tint, but the export still shows terrain).
    ctx.save();
    ctx.globalAlpha = opacity;
    paint(ctx);
    ctx.restore();
    return;
  }
  paint(offscreenCtx);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(offscreen, 0, 0);
  ctx.restore();
}
