// ============================================================================
// TOKENS LAYER COMPONENT
// ============================================================================
// Renders all player tokens with drag and interaction support

import { Group, Rect } from "react-konva";
import type { Token } from "@shared";
import type { Camera } from "../types";

interface TokensLayerProps {
  cam: Camera;
  tokens: Token[];
  uid: string;
  gridSize: number;
  hoveredTokenId: string | null;
  onHover: (id: string | null) => void;
  onMoveToken: (id: string, x: number, y: number) => void;
  onRecolorToken: (id: string) => void;
  onDeleteToken?: (id: string) => void;
  snapToGrid: boolean;
}

/**
 * TokensLayer: Renders all player tokens
 * - Players can drag their own tokens
 * - Double-click to recolor
 * - Other players' tokens are non-interactive
 */
export function TokensLayer({
  cam,
  tokens,
  uid,
  gridSize,
  hoveredTokenId,
  onHover,
  onMoveToken,
  onRecolorToken,
  snapToGrid,
}: TokensLayerProps) {
  const myTokens = tokens.filter((t) => t.owner === uid);
  const otherTokens = tokens.filter((t) => t.owner !== uid);

  const handleDrag = (tokenId: string, e: any) => {
    const pos = e.target.position();
    // Convert screen position to grid coordinates
    let gx, gy;
    if (snapToGrid) {
      gx = Math.round(pos.x / gridSize);
      gy = Math.round(pos.y / gridSize);
    } else {
      gx = pos.x / gridSize;
      gy = pos.y / gridSize;
    }
    onMoveToken(tokenId, gx, gy);
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {/* Render other players' tokens first */}
      {otherTokens.map((t) => (
        <Rect
          key={t.id}
          x={t.x * gridSize + gridSize / 4}
          y={t.y * gridSize + gridSize / 4}
          width={gridSize / 2}
          height={gridSize / 2}
          fill={t.color}
          stroke={hoveredTokenId === t.id ? "#aaa" : "none"}
          strokeWidth={2 / cam.scale}
          onMouseEnter={() => onHover(t.id)}
          onMouseLeave={() => onHover(null)}
        />
      ))}

      {/* Render my tokens last (on top) */}
      {myTokens.map((t) => (
        <Rect
          key={t.id}
          x={t.x * gridSize + gridSize / 4}
          y={t.y * gridSize + gridSize / 4}
          width={gridSize / 2}
          height={gridSize / 2}
          fill={t.color}
          stroke="#fff"
          strokeWidth={2 / cam.scale}
          draggable
          onDragEnd={(e) => handleDrag(t.id, e)}
          onMouseEnter={() => onHover(t.id)}
          onMouseLeave={() => onHover(null)}
          onDblClick={() => onRecolorToken(t.id)}
        />
      ))}
    </Group>
  );
}
