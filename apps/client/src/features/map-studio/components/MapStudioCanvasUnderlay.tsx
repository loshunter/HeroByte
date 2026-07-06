import { useEffect, useRef, useState } from "react";
import { useAnimationFrameIndex } from "../../render/useAnimationClock";
import { drawGrid } from "../../render/gridRenderCore";
import { useTileAtlas } from "../../render/tileAtlas";
import { drawTerrain, type StructuredTerrainLayer } from "../../render/tileRenderCore";
import { terrainStyleForFrame } from "../starterTiles";
import type { MapViewBox } from "./MapStudioWorkspace.types";
import { renderedSvgViewport } from "./mapStudioWorkspaceUtils";

/** Longest animated terrain cycle; the clock frame wraps within this. */
const TERRAIN_ANIM_FRAMES = 4;
/** Letterbox behind the document — was the SVG element's background. */
const BACKDROP_FILL = "#151822";
const DOCUMENT_FILL = "#24212b";
const GRID_STROKE = "rgba(127,214,255,0.22)";

interface UnderlayGrid {
  size: number;
  offsetX: number;
  offsetY: number;
  visible: boolean;
}

export interface MapStudioCanvasUnderlayProps {
  documentWidth: number;
  documentHeight: number;
  grid: UnderlayGrid;
  terrainLayers: StructuredTerrainLayer[];
  /** Terrain-kind layer opacity; 0 when the layer is hidden. */
  terrainOpacity: number;
  /** Whether any painted family animates; false skips the clock entirely. */
  animated: boolean;
  viewBox: MapViewBox;
}

/**
 * The canvas beneath the studio SVG: backdrop, document background, grid
 * lattice, and painted terrain, drawn through the shared tile-render core
 * and synced to the camera viewBox with the same letterbox math the SVG's
 * preserveAspectRatio uses. Water shimmers on the shared animation clock;
 * the SVG above keeps element handles, ghosts, and selection.
 */
export function MapStudioCanvasUnderlay({
  documentWidth,
  documentHeight,
  grid,
  terrainLayers,
  terrainOpacity,
  animated,
  viewBox,
}: MapStudioCanvasUnderlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const frame = useAnimationFrameIndex(TERRAIN_ANIM_FRAMES, animated);
  const atlas = useTileAtlas();
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setResizeTick((tick) => tick + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // A monitor move can change devicePixelRatio without any CSS resize (the
  // ResizeObserver watches CSS pixels), leaving a blurry stale backing store
  // on static maps. Re-armed after every redraw so the query tracks the
  // current ratio.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => setResizeTick((tick) => tick + 1);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [resizeTick]);

  useEffect(() => {
    void resizeTick; // resizing retriggers the draw with fresh dimensions
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * devicePixelRatio);
    const height = Math.round(rect.height * devicePixelRatio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BACKDROP_FILL;
    ctx.fillRect(0, 0, width, height);

    const viewport = renderedSvgViewport(rect, viewBox);
    const cssScale = viewport.width / viewBox.width;
    const scale = cssScale * devicePixelRatio;
    const translateX = viewport.offsetX * devicePixelRatio - viewBox.x * scale;
    const translateY = viewport.offsetY * devicePixelRatio - viewBox.y * scale;
    ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
    ctx.fillStyle = DOCUMENT_FILL;
    ctx.fillRect(0, 0, documentWidth, documentHeight);

    // The full canvas maps to a world rect LARGER than the viewBox whenever
    // the pane's aspect differs from the document's (letterbox bands). Cull
    // against everything visible, not just the viewBox — zoomed in, those
    // bands sit inside the document and must keep their grid and terrain.
    const view = {
      x: viewBox.x - viewport.offsetX / cssScale,
      y: viewBox.y - viewport.offsetY / cssScale,
      width: rect.width / cssScale,
      height: rect.height / cssScale,
    };

    if (grid.visible) {
      // Grid clips to the document rect, like the SVG pattern <rect> did.
      // The editor lattice is square regardless of grid type, matching the
      // SVG pattern this replaces (hex/iso guides come later).
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, documentWidth, documentHeight);
      ctx.clip();
      drawGrid(
        ctx,
        {
          width: grid.size,
          height: grid.size,
          path: `M ${grid.size} 0 L 0 0 0 ${grid.size}`,
          offsetX: grid.offsetX,
          offsetY: grid.offsetY,
        },
        view,
        { color: GRID_STROKE, alpha: 1, lineWidth: Math.max(1, grid.size / 48) },
      );
      ctx.restore();
    }
    // Terrain is NOT clipped to the document: the old SVG stroked boundary
    // edges past the document rect and painted out-of-document cells.
    if (terrainOpacity > 0 && terrainLayers.length > 0) {
      const boundaryWidth = Math.max(2, grid.size * 0.04);
      const drawOptions = { boundaryWidth, atlas: atlas ?? undefined };
      if (terrainOpacity >= 1) {
        drawTerrain(ctx, terrainLayers, terrainStyleForFrame, frame, view, drawOptions);
      } else {
        // SVG applied the layer opacity per family <g>: flatten the family
        // opaquely, then fade the flattened result once. Per-primitive
        // globalAlpha would tint boundary strokes with the fill beneath
        // them, so replicate the group semantics via an offscreen blit.
        const offscreen =
          offscreenRef.current ?? (offscreenRef.current = window.document.createElement("canvas"));
        if (offscreen.width !== width) offscreen.width = width;
        if (offscreen.height !== height) offscreen.height = height;
        const offscreenCtx = offscreen.getContext("2d");
        if (offscreenCtx) {
          for (const layer of terrainLayers) {
            offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
            offscreenCtx.clearRect(0, 0, width, height);
            offscreenCtx.setTransform(scale, 0, 0, scale, translateX, translateY);
            drawTerrain(offscreenCtx, [layer], terrainStyleForFrame, frame, view, drawOptions);
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = terrainOpacity;
            ctx.drawImage(offscreen, 0, 0);
            ctx.restore();
          }
        }
      }
    }
  }, [
    documentWidth,
    documentHeight,
    grid,
    terrainLayers,
    terrainOpacity,
    viewBox,
    frame,
    atlas,
    resizeTick,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
