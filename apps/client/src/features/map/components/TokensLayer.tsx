// ============================================================================
// TOKENS LAYER COMPONENT
// ============================================================================
// Renders all player tokens with drag and interaction support

import { memo } from "react";
import { Group, Rect, Image as KonvaImage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Token } from "@shared";
import type { Camera } from "../types";
import useImage from "use-image";

interface TokenSpriteProps {
  token: Token;
  gridSize: number;
  stroke: string;
  strokeWidth: number;
  draggable?: boolean;
  onDragEnd?: (event: KonvaEventObject<DragEvent>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick?: () => void;
}

const TokenSprite = memo(function TokenSprite({
  token,
  gridSize,
  stroke,
  strokeWidth,
  draggable = false,
  onDragEnd,
  onHover,
  onDoubleClick,
}: TokenSpriteProps) {
  const [image, status] = useImage(token.imageUrl ?? "", "anonymous");

  const x = token.x * gridSize + gridSize / 4;
  const y = token.y * gridSize + gridSize / 4;
  const size = gridSize / 2;

  const commonProps = {
    x,
    y,
    width: size,
    height: size,
    cornerRadius: gridSize / 8,
    stroke,
    strokeWidth,
    draggable,
    onDragEnd,
    onMouseEnter: () => onHover(token.id),
    onMouseLeave: () => onHover(null),
    onDblClick: onDoubleClick,
  } as const;

  if (token.imageUrl && status === "loaded" && image) {
    return <KonvaImage image={image} {...commonProps} />;
  }

  return <Rect fill={token.color} {...commonProps} />;
});

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
 *
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const TokensLayer = memo(function TokensLayer({
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

  const handleDrag = (tokenId: string, event: KonvaEventObject<DragEvent>) => {
    const pos = event.target.position();
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
        <TokenSprite
          key={t.id}
          token={t}
          gridSize={gridSize}
          stroke={hoveredTokenId === t.id ? "#aaa" : "transparent"}
          strokeWidth={2 / cam.scale}
          onHover={onHover}
        />
      ))}

      {/* Render my tokens last (on top) */}
      {myTokens.map((t) => (
        <TokenSprite
          key={t.id}
          token={t}
          gridSize={gridSize}
          stroke="#fff"
          strokeWidth={2 / cam.scale}
          draggable
          onDragEnd={(e) => handleDrag(t.id, e)}
          onHover={onHover}
          onDoubleClick={() => onRecolorToken(t.id)}
        />
      ))}
    </Group>
  );
});
