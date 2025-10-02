// ============================================================================
// POINTERS LAYER COMPONENT
// ============================================================================
// Renders temporary pointer indicators from other players

import { memo } from "react";
import { Group, Circle, Text } from "react-konva";
import type { Pointer, Player, Token } from "@shared";
import type { Camera } from "../types";

interface PointersLayerProps {
  cam: Camera;
  pointers: Pointer[];
  players: Player[];
  tokens: Token[];
}

/**
 * PointersLayer: Renders temporary pointer indicators
 * Shows player name and uses their token color
 *
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const PointersLayer = memo(function PointersLayer({ cam, pointers, players, tokens }: PointersLayerProps) {
  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {pointers.map((pointer) => {
        const player = players.find((p) => p.uid === pointer.uid);
        const token = tokens.find((t) => t.owner === pointer.uid);
        return (
          <Group key={pointer.uid}>
            <Circle
              x={pointer.x}
              y={pointer.y}
              radius={20}
              fill={token?.color || "#fff"}
              opacity={0.6}
            />
            <Text
              x={pointer.x}
              y={pointer.y + 30}
              text={player?.name || "???"}
              fill={token?.color || "#fff"}
              fontSize={12 / cam.scale}
              fontStyle="bold"
              align="center"
              offsetX={30}
            />
          </Group>
        );
      })}
    </Group>
  );
});
