// ============================================================================
// FOG LAYER COMPONENT
// ============================================================================
// Fog of war: darkens the published scene and punches out what the player's
// own tokens can see. Vision polygons are computed in map-document space with
// the shared visibility math — the SAME function the server filters entities
// with, called through the same entry point (computeViewerVisionPolygon), so
// what you can see and what your socket receives cannot drift apart.
//
// Each viewer carries its own sight radius in feet (S7). Undefined means
// unlimited, which is how fog behaved before radii existed.
//
// Three bands, drawn in this order inside ONE layer so a single composite pass
// produces all of them:
//   1. opaque fog over the whole published rect — never seen,
//   2. the EXPLORED mask punched out at partial opacity — seen before, dimmed,
//   3. current sightlines punched out fully — seen right now.
// Konva applies node opacity BEFORE the composite operation, so a
// `destination-out` image at 0.55 erases 55% of the fog rather than all of it.
// The explored band is a RENDERING convenience only: it re-shows map art the
// client already holds, never an entity, because the server never sent one.

import { useMemo } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect } from "react-konva";
import {
  computeViewerVisionPolygon,
  getVisionBlockingSegments,
  type CompiledScene,
  type SceneObjectTransform,
} from "@herobyte/shared";
import type { FogViewer } from "../playerLens";
import type { Camera } from "../types";
import { useExploredFog } from "./useExploredFog";

interface FogLayerProps {
  cam: Camera;
  compiledScene: CompiledScene;
  mapTransform?: SceneObjectTransform;
  /** World-space viewers whose sightlines lift the fog (the player's own tokens). */
  viewers: FogViewer[];
  /** World pixels per grid square (`RoomSnapshot.gridSize`). */
  gridSize: number;
  /** Feet per grid square (`RoomSnapshot.gridSquareSize`, default 5). */
  gridSquareSize: number;
  /**
   * Where this viewer's memory of the map is kept, or null to remember nothing.
   *
   * Scoped per table, per PLAYER uid and per map document by the caller. The
   * uid segment is the structural guard that a DM inspecting through the player
   * lens — whose viewers are the whole party's union, not any one player's —
   * accumulates under their OWN key and can never write into a player's memory.
   */
  exploredStorageKey?: string | null;
}

const FOG_COLOR = "#0b0b16";
/** How much of the fog a remembered area lifts. Dimmed, deliberately not clear. */
const EXPLORED_LIFT = 0.55;

export function FogLayer({
  cam,
  compiledScene,
  mapTransform,
  viewers,
  gridSize,
  gridSquareSize,
  exploredStorageKey = null,
}: FogLayerProps) {
  // VALUE keys, not object identity. A full room snapshot is re-parsed from
  // JSON on every broadcast, so `compiledScene` and `mapTransform` arrive as
  // fresh objects during unrelated play (chat, dice, HP, initiative) even when
  // the geometry is byte-identical — and re-sweeping is measured in tens of
  // milliseconds on a large dungeon. Same reasoning as TerrainLayer's
  // `terrainKey`. Door state is in the key because opening a door genuinely
  // changes what can be seen; nothing else about a compiled scene can change
  // without its revision moving.
  const sceneKey = [
    compiledScene.sourceDocumentId,
    compiledScene.sourceRevision,
    compiledScene.compiledAt,
    compiledScene.width,
    compiledScene.height,
    compiledScene.doors.map((door) => door.state).join(","),
  ].join("|");
  const transformKey = mapTransform
    ? `${mapTransform.x},${mapTransform.y},${mapTransform.scaleX},${mapTransform.scaleY},${mapTransform.rotation}`
    : "";
  // The radius belongs in this key. Without it, changing a token's sight
  // radius returns the PREVIOUS polygons and the fog simply never repaints —
  // the client twin of the server's visionSignature, and a silent one.
  const viewersKey = viewers
    .map((viewer) => `${viewer.x},${viewer.y},${viewer.radiusFeet ?? ""}`)
    .join(";");

  const polygons = useMemo(() => {
    const segments = getVisionBlockingSegments(compiledScene);
    const bounds = { width: compiledScene.width, height: compiledScene.height };
    return viewers.map((viewer) =>
      computeViewerVisionPolygon({
        origin: viewer,
        radiusFeet: viewer.radiusFeet,
        segments,
        bounds,
        gridSize,
        gridSquareSize,
        mapTransform,
      }),
    );
    // The three string keys stand in for the object/array identities above.
  }, [sceneKey, transformKey, viewersKey, gridSize, gridSquareSize]);

  // Memoized with the polygons, not rebuilt per render: `cam` is a fresh
  // object on every wheel tick and pan frame, so without this the flatMap
  // below allocated a 2-number-per-vertex array per viewer per frame — several
  // thousand numbers each, on a large scene.
  const holes = useMemo(
    () =>
      polygons.map((polygon, index) =>
        polygon.length >= 3 ? (
          <Line
            key={index}
            points={polygon.flatMap((vertex) => [vertex.x, vertex.y])}
            closed
            fill="#000000"
            globalCompositeOperation="destination-out"
          />
        ) : null,
      ),
    [polygons],
  );

  const explored = useExploredFog({
    storageKey: exploredStorageKey,
    sceneWidth: compiledScene.width,
    sceneHeight: compiledScene.height,
    polygons,
  });

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};

  return (
    <Layer listening={false}>
      <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
        <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation}>
          <Rect
            x={0}
            y={0}
            width={compiledScene.width}
            height={compiledScene.height}
            fill={FOG_COLOR}
            opacity={0.97}
          />
          {explored.canvas && (
            <KonvaImage
              // Mutating canvas pixels does not change its identity, so the
              // revision is what tells react-konva the node is dirty.
              key={`explored-${explored.revision}`}
              image={explored.canvas}
              x={0}
              y={0}
              width={compiledScene.width}
              height={compiledScene.height}
              listening={false}
              opacity={EXPLORED_LIFT}
              globalCompositeOperation="destination-out"
            />
          )}
          {holes}
        </Group>
      </Group>
    </Layer>
  );
}
