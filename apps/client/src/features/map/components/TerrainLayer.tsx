// ============================================================================
// TERRAIN LAYER COMPONENT
// ============================================================================
// Draws published painted terrain (R5) at the live table through the shared
// tile-render core — the same geometry + atlas the Map Studio editor draws, so
// terrain looks identical before and after publish. Sits UNDER the elements-
// only background image in the background Layer, so uploaded/legacy full-render
// backgrounds (which carry no snapshot.mapTerrain) keep the raster path
// untouched. Water shimmers on the shared 300ms clock; reduced motion freezes
// it to frame 0 for free via the clock.

import { useEffect, useMemo, useRef } from "react";
import { Group, Shape } from "react-konva";
import type Konva from "konva";
import type { MapTerrainSnapshot, SceneObjectTransform } from "@herobyte/shared";
import { useAnimationFrameIndex } from "../../render/useAnimationClock";
import { useTileAtlas } from "../../render/tileAtlas";
import type { TileRenderContext2D } from "../../render/tileRenderCore";
import { buildStructuredTerrainLayers } from "../../map-studio/terrainRender";
import { buildTerrainOnlyOccupancy } from "../../map-studio/tileAutotiling";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import { drawTableTerrain } from "./terrainSceneFunc";
import type { Camera } from "../types";

/** Longest animated terrain cycle; the clock frame wraps within this. */
const TERRAIN_ANIM_FRAMES = 4;

interface TerrainLayerProps {
  cam: Camera;
  mapTerrain: MapTerrainSnapshot;
  /** The map object's transform — terrain must move/scale WITH the background. */
  mapTransform?: SceneObjectTransform;
}

/**
 * TerrainLayer: renders snapshot.mapTerrain beneath the map image.
 *
 * Applies the same two transforms as MapImageLayer so terrain stays glued to
 * the background when a DM moves or scales the map:
 * 1. Camera transform (pan/zoom) — the outer Group.
 * 2. Map object transform (position/scale/rotation) — the inner Group.
 */
export function TerrainLayer({ cam, mapTerrain, mapTransform }: TerrainLayerProps) {
  const atlas = useTileAtlas();

  // A full room snapshot is re-parsed from JSON on every broadcast, so
  // snapshot.mapTerrain gets a fresh object identity ~60x/sec during unrelated
  // play (fog, drawings, initiative) even when the terrain is byte-identical.
  // Key the expensive geometry build on the serialized VALUE — the RLE is
  // compact (O(runs), not O(cells)) — so it only rebuilds when terrain actually
  // changes on a Publish, not on every unrelated snapshot.
  const terrainKey = useMemo(() => JSON.stringify(mapTerrain), [mapTerrain]);
  const layers = useMemo(
    () =>
      buildStructuredTerrainLayers(
        mapTerrain.terrain,
        mapTerrain.grid,
        buildTerrainOnlyOccupancy(mapTerrain.terrain),
      ),
    [terrainKey],
  );

  // Only water (animFills) animates; a still map skips the clock entirely.
  const animated = useMemo(
    () => layers.some((layer) => (getMapStudioTileAsset(layer.assetId).animFills?.length ?? 0) > 0),
    [layers],
  );
  const frame = useAnimationFrameIndex(TERRAIN_ANIM_FRAMES, animated);

  // Match the editor underlay's boundary width so both surfaces render terrain
  // identically at every grid size (the SVG export's constant 2 is a parity
  // contract; the live canvases scale with the grid).
  const boundaryWidth = Math.max(2, mapTerrain.grid.size * 0.04);
  const opacity = mapTerrain.opacity;

  const groupRef = useRef<Konva.Group>(null);
  // Repaint on animation frame advances (and once when the atlas finishes its
  // async load). Keyed ONLY on the animating inputs — never on mapTerrain
  // identity — so an unrelated snapshot broadcast does not force a repaint of
  // the shared background layer.
  useEffect(() => {
    groupRef.current?.getLayer()?.batchDraw();
  }, [frame, atlas]);

  // One Shape PER FAMILY. When the terrain layer's opacity is < 1, Konva
  // composites each family through its buffer canvas — flatten the family's
  // fill+stroke opaquely, then fade the result once — matching the Map Studio
  // editor underlay and the SVG export. A single shared Shape would instead
  // apply globalAlpha per primitive and tint each boundary stroke with the fill
  // beneath it. The fill/stroke attrs below are never painted (the sceneFunc
  // draws through the raw 2D context); they exist only to satisfy Konva's
  // hasFill/hasStroke gate for that buffer canvas. Memoized so byte-identical
  // terrain across snapshot churn yields stable elements (React bails; no repaint).
  const shapes = useMemo(
    () =>
      layers.map((layer) => (
        <Shape
          key={layer.assetId}
          listening={false}
          opacity={opacity}
          fill="#000000"
          stroke="#000000"
          sceneFunc={(context) => {
            // Konva.Context wraps the native 2D context; `_context` is the
            // documented escape hatch to the raw CanvasRenderingContext2D the
            // shared core draws through. Konva has already applied the camera +
            // map transform (and, when buffering, targets the buffer context).
            const ctx = (context as unknown as { _context: CanvasRenderingContext2D })
              ._context as unknown as TileRenderContext2D;
            drawTableTerrain(ctx, [layer], atlas, frame, boundaryWidth);
          }}
        />
      )),
    [layers, atlas, frame, boundaryWidth, opacity],
  );

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group ref={groupRef} x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation}>
        {shapes}
      </Group>
    </Group>
  );
}
