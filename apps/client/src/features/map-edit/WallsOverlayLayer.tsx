// ============================================================================
// WALLS OVERLAY LAYER (DM-only)
// ============================================================================
// Draws the compiled scene's blocking walls as thin, subtle lines so a DM can
// see what they have built while authoring — walls are otherwise invisible
// (they only shape fog + block movement). Players NEVER see this: the mount
// site in MapBoard gates it on isDM. listening={false} so it never intercepts
// clicks. Same nested camera + map-transform groups as the compiled layers.

import { Group, Line } from "react-konva";
import type { CompiledWallSegment, SceneObjectTransform } from "@herobyte/shared";
import type { Camera } from "../map/types";

interface WallsOverlayLayerProps {
  cam: Camera;
  mapTransform?: SceneObjectTransform;
  walls: CompiledWallSegment[];
}

const WALL_COLOR = "#e9d8a6"; // muted parchment gold — reads without shouting

export function WallsOverlayLayer({ cam, mapTransform, walls }: WallsOverlayLayerProps) {
  if (!walls.length) return null;

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};
  const strokeWidth = 2 / cam.scale;

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation} listening={false}>
        {walls.map((wall) => (
          <Line
            key={wall.id}
            points={[wall.x1, wall.y1, wall.x2, wall.y2]}
            stroke={WALL_COLOR}
            strokeWidth={strokeWidth}
            opacity={0.35}
            lineCap="round"
            listening={false}
          />
        ))}
      </Group>
    </Group>
  );
}
