// ============================================================================
// FOG LAYER COMPONENT
// ============================================================================
// Fog of war: darkens the published scene and punches out what the player's
// own tokens can see. Vision polygons are computed in map-document space with
// the shared visibility math (the same code the server will use for entity
// filtering), so fog stays pixel-aligned with the published art under any
// live map transform.

import { useMemo } from "react";
import { Group, Layer, Line, Rect } from "react-konva";
import {
  computeVisionPolygon,
  getVisionBlockingSegments,
  inverseTransformScenePoint,
  type CompiledScene,
  type SceneObjectTransform,
  type ScenePoint,
} from "@herobyte/shared";
import type { Camera } from "../types";

interface FogLayerProps {
  cam: Camera;
  compiledScene: CompiledScene;
  mapTransform?: SceneObjectTransform;
  /** World-space positions whose sightlines lift the fog (the player's own tokens). */
  viewers: ScenePoint[];
}

const FOG_COLOR = "#0b0b16";

export function FogLayer({ cam, compiledScene, mapTransform, viewers }: FogLayerProps) {
  const viewersKey = viewers.map((viewer) => `${viewer.x},${viewer.y}`).join(";");

  const polygons = useMemo(() => {
    const segments = getVisionBlockingSegments(compiledScene);
    const bounds = { width: compiledScene.width, height: compiledScene.height };
    return viewers.map((viewer) => {
      const origin = mapTransform ? inverseTransformScenePoint(mapTransform, viewer) : viewer;
      return computeVisionPolygon(origin, segments, bounds);
    });
    // viewersKey stands in for the viewers array identity.
  }, [compiledScene, mapTransform, viewersKey]);

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
          {polygons.map((polygon, index) =>
            polygon.length >= 3 ? (
              <Line
                key={index}
                points={polygon.flatMap((vertex) => [vertex.x, vertex.y])}
                closed
                fill="#000000"
                globalCompositeOperation="destination-out"
              />
            ) : null,
          )}
        </Group>
      </Group>
    </Layer>
  );
}
