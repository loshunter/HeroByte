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

import { useMemo } from "react";
import { Group, Layer, Line, Rect } from "react-konva";
import {
  computeViewerVisionPolygon,
  getVisionBlockingSegments,
  type CompiledScene,
  type SceneObjectTransform,
} from "@herobyte/shared";
import type { FogViewer } from "../playerLens";
import type { Camera } from "../types";

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
}

const FOG_COLOR = "#0b0b16";

export function FogLayer({
  cam,
  compiledScene,
  mapTransform,
  viewers,
  gridSize,
  gridSquareSize,
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
          {holes}
        </Group>
      </Group>
    </Layer>
  );
}
