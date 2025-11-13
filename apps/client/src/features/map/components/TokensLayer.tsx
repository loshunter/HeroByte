// ============================================================================
// TOKENS LAYER COMPONENT (SCENE OBJECT VERSION)
// ============================================================================
// Renders tokens from the unified scene graph with drag support.

import { memo, useEffect, useRef, useState } from "react";
import { Group, Rect, Image as KonvaImage, Circle, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneObject } from "@shared";
import useImage from "use-image";
import type { Camera } from "../types";
import { LockIndicator } from "./LockIndicator";

interface TokenSpriteProps {
  object: SceneObject & { type: "token" };
  gridSize: number;
  stroke: string;
  strokeWidth: number;
  interactive: boolean;
  draggable?: boolean;
  onDragEnd?: (event: KonvaEventObject<DragEvent>) => void;
  onDragStart?: (event: KonvaEventObject<DragEvent>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick?: () => void;
  onClick?: (event: KonvaEventObject<MouseEvent>) => void;
  onNodeReady?: (node: Konva.Node | null) => void;
}

const TokenSprite = memo(function TokenSprite({
  object,
  gridSize,
  stroke,
  strokeWidth,
  draggable = false,
  interactive,
  onDragEnd,
  onDragStart,
  onHover,
  onDoubleClick,
  onClick,
  onNodeReady,
}: TokenSpriteProps) {
  const { data, transform, id } = object;
  const [image, status] = useImage(data.imageUrl ?? "");

  // Calculate size multiplier based on token size category
  const sizeMultipliers: Record<string, number> = {
    tiny: 0.5,
    small: 0.75,
    medium: 1.0,
    large: 1.5,
    huge: 2.0,
    gargantuan: 3.0,
  };
  const sizeMultiplier = sizeMultipliers[data.size ?? "medium"] ?? 1.0;

  const size = gridSize * 0.75 * sizeMultiplier;
  const offset = size / 2;

  const commonProps = {
    x: transform.x * gridSize + gridSize / 2 - offset,
    y: transform.y * gridSize + gridSize / 2 - offset,
    width: size,
    height: size,
    rotation: transform.rotation,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    cornerRadius: gridSize / 8,
    stroke,
    strokeWidth,
    draggable,
    onDragEnd,
    onDragStart,
    onMouseEnter: () => onHover(id),
    onMouseLeave: () => onHover(null),
    listening: interactive,
    onDblClick: onDoubleClick,
    onClick,
    id,
    name: id,
    attrs: { "data-token-id": id },
    ref: (node: Konva.Node | null) => {
      if (onNodeReady) {
        onNodeReady(node);
      }
    },
  } as const;

  if (data.imageUrl && status === "loaded" && image) {
    return <KonvaImage image={image} {...commonProps} />;
  }

  return <Rect fill={data.color} {...commonProps} />;
});

interface MultiSelectBadgeProps {
  x: number;
  y: number;
  size: number;
  count: number;
}

const MultiSelectBadge = memo(function MultiSelectBadge({
  x,
  y,
  size,
  count,
}: MultiSelectBadgeProps) {
  const radius = size / 2;
  const fontSize = size * 0.6;

  return (
    <Group x={x} y={y}>
      <Circle radius={radius} fill="#447DF7" stroke="#FFFFFF" strokeWidth={2} />
      <Text
        text={count.toString()}
        fontSize={fontSize}
        fontFamily="Arial"
        fontStyle="bold"
        fill="#FFFFFF"
        align="center"
        verticalAlign="middle"
        offsetX={fontSize / 2.5}
        offsetY={fontSize / 2.5}
      />
    </Group>
  );
});

interface StatusEffectBadgeProps {
  x: number;
  y: number;
  size: number;
  emoji: string;
}

const StatusEffectBadge = memo(function StatusEffectBadge({
  x,
  y,
  size,
  emoji,
}: StatusEffectBadgeProps) {
  const fontSize = size * 0.7;
  const bgRadius = size / 2;

  return (
    <Group x={x} y={y}>
      <Circle
        radius={bgRadius}
        fill="rgba(0, 0, 0, 0.7)"
        stroke="var(--jrpg-border-gold)"
        strokeWidth={1.5}
      />
      <Text
        text={emoji}
        fontSize={fontSize}
        fontFamily="Arial"
        fill="#FFFFFF"
        align="center"
        verticalAlign="middle"
        width={size}
        height={size}
        x={-size / 2}
        y={-size / 2}
      />
    </Group>
  );
});

interface TokensLayerProps {
  cam: Camera;
  sceneObjects: SceneObject[];
  uid: string;
  gridSize: number;
  hoveredTokenId: string | null;
  onHover: (id: string | null) => void;
  onTransformToken: (sceneId: string, position: { x: number; y: number }) => void;
  onRecolorToken: (sceneId: string, owner: string | null | undefined) => void;
  snapToGrid: boolean;
  selectedObjectId?: string | null;
  selectedObjectIds: string[];
  onSelectObject?: (
    objectId: string | null,
    options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
  ) => void;
  onTokenNodeReady?: (tokenId: string, node: Konva.Node | null) => void;
  interactionsEnabled?: boolean;
  /** Map of token scene ID (e.g., "token:abc123") to status effect emoji */
  statusEffectsByTokenId?: Record<string, string>;
}

export const TokensLayer = memo(function TokensLayer({
  cam,
  sceneObjects,
  uid,
  gridSize,
  hoveredTokenId,
  onHover,
  onTransformToken,
  onRecolorToken,
  snapToGrid,
  selectedObjectId,
  selectedObjectIds = [],
  onSelectObject,
  onTokenNodeReady,
  interactionsEnabled = true,
  statusEffectsByTokenId = {},
}: TokensLayerProps) {
  const localOverrides = useRef<Record<string, { x: number; y: number }>>({});
  const multiDragStartRef = useRef<Record<string, { x: number; y: number }>>({});
  const [, forceRerender] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const tokens = sceneObjects.filter((object): object is SceneObject & { type: "token" } => {
    return object.type === "token";
  });

  const myTokens = tokens.filter((object) => object.owner === uid);
  const otherTokens = tokens.filter((object) => object.owner !== uid);

  // Count selected tokens for multi-select badge
  const selectedTokenCount = selectedObjectIds.filter((id) => id.startsWith("token:")).length;

  const handleDrag = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    try {
      const pos = event.target.position();

      let gx: number;
      let gy: number;
      if (snapToGrid) {
        gx = Math.round(pos.x / gridSize);
        gy = Math.round(pos.y / gridSize);
      } else {
        gx = pos.x / gridSize;
        gy = pos.y / gridSize;
      }

      const snappedX = gx * gridSize;
      const snappedY = gy * gridSize;
      event.target.position({ x: snappedX, y: snappedY });

      const startPositions = multiDragStartRef.current;
      const base = startPositions[sceneId];
      if (base) {
        const deltaX = gx - base.x;
        const deltaY = gy - base.y;

        const entries = Object.entries(startPositions);
        if (entries.length > 0) {
          for (const [id, start] of entries) {
            const nextX = start.x + deltaX;
            const nextY = start.y + deltaY;
            localOverrides.current[id] = { x: nextX, y: nextY };
            onTransformToken(id, { x: nextX, y: nextY });
          }
        } else {
          localOverrides.current[sceneId] = { x: gx, y: gy };
          onTransformToken(sceneId, { x: gx, y: gy });
        }
      } else {
        localOverrides.current[sceneId] = { x: gx, y: gy };
        onTransformToken(sceneId, { x: gx, y: gy });
      }

      forceRerender((value) => value + 1);

      setDraggingId(null);
      multiDragStartRef.current = {};
    } catch (error) {
      // Ignore errors during drag (transformer may still be detaching)
      console.warn("[TokensLayer] Drag error:", error);
      setDraggingId(null);
      multiDragStartRef.current = {};
    }
  };

  const handleDragStart = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
    setDraggingId(sceneId);

    const alreadySelected = selectedObjectIds.includes(sceneId);
    if (!alreadySelected && onSelectObject) {
      const native = event?.evt as MouseEvent | PointerEvent | undefined;
      const append = native?.shiftKey ?? false;
      const toggle = native?.ctrlKey || native?.metaKey || false;
      const mode = append ? "append" : toggle ? "toggle" : "replace";
      onSelectObject(sceneId, { mode });
    }

    const idsForDrag = (alreadySelected ? selectedObjectIds : [sceneId]).filter((id) =>
      id.startsWith("token:"),
    );

    const starts: Record<string, { x: number; y: number }> = {};
    for (const object of tokens) {
      if (idsForDrag.includes(object.id)) {
        starts[object.id] = { x: object.transform.x, y: object.transform.y };
      }
    }

    if (!starts[sceneId]) {
      const target = tokens.find((candidate) => candidate.id === sceneId);
      if (target) {
        starts[sceneId] = { x: target.transform.x, y: target.transform.y };
      }
    }

    multiDragStartRef.current = starts;
  };

  useEffect(() => {
    const overrides = localOverrides.current;
    const keys = Object.keys(overrides);
    if (keys.length === 0) return;

    const next = { ...overrides };
    let dirty = false;
    for (const key of keys) {
      const object = tokens.find((candidate) => candidate.id === key);
      const override = overrides[key];
      if (!object) {
        delete next[key];
        dirty = true;
        continue;
      }
      const matches =
        Math.abs(object.transform.x - override.x) < 0.001 &&
        Math.abs(object.transform.y - override.y) < 0.001;
      if (matches) {
        delete next[key];
        dirty = true;
      }
    }

    if (dirty) {
      localOverrides.current = next;
      forceRerender((value) => value + 1);
    }
  }, [tokens]);

  const mapOverrides = (object: SceneObject & { type: "token" }) => {
    const override = localOverrides.current[object.id];
    if (!override) return object;
    return {
      ...object,
      transform: {
        ...object.transform,
        x: override.x,
        y: override.y,
      },
    };
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {otherTokens.map((object) => {
        const isSelected = selectedObjectIds.includes(object.id) || selectedObjectId === object.id;
        const isFirstSelected = selectedTokenCount > 1 && selectedObjectIds[0] === object.id;
        return (
          <Group key={object.id}>
            <TokenSprite
              object={mapOverrides(object)}
              gridSize={gridSize}
              stroke={
                isSelected ? "#447DF7" : hoveredTokenId === object.id ? "#aaa" : "transparent"
              }
              strokeWidth={isSelected ? 3 / cam.scale : 2 / cam.scale}
              interactive={interactionsEnabled}
              onHover={onHover}
              onClick={(event) => {
                if (!onSelectObject) {
                  return;
                }
                const native = event?.evt;
                const append = native?.shiftKey ?? false;
                const toggle = native?.ctrlKey || native?.metaKey || false;
                const mode = append ? "append" : toggle ? "toggle" : "replace";
                if (event) {
                  event.cancelBubble = true;
                }
                onSelectObject(object.id, { mode });
              }}
              onNodeReady={
                onTokenNodeReady ? (node) => onTokenNodeReady(object.id, node) : undefined
              }
            />
            {object.locked && (
              <LockIndicator
                x={object.transform.x * gridSize + gridSize / 2}
                y={object.transform.y * gridSize + gridSize / 2 - gridSize * 0.45}
                size={gridSize * 0.25}
              />
            )}
            {statusEffectsByTokenId[object.id] && (
              <StatusEffectBadge
                x={object.transform.x * gridSize + gridSize * 0.15}
                y={object.transform.y * gridSize + gridSize * 0.15}
                size={gridSize * 0.3}
                emoji={statusEffectsByTokenId[object.id]}
              />
            )}
            {isFirstSelected && (
              <MultiSelectBadge
                x={object.transform.x * gridSize + gridSize * 0.85}
                y={object.transform.y * gridSize + gridSize * 0.15}
                size={gridSize * 0.3}
                count={selectedTokenCount}
              />
            )}
          </Group>
        );
      })}

      {myTokens.map((object) => {
        const isSelected = selectedObjectIds.includes(object.id) || selectedObjectId === object.id;
        const isFirstSelected = selectedTokenCount > 1 && selectedObjectIds[0] === object.id;
        return (
          <Group key={object.id}>
            <TokenSprite
              object={mapOverrides(object)}
              gridSize={gridSize}
              stroke={isSelected ? "#447DF7" : draggingId === object.id ? "#44f" : "#fff"}
              strokeWidth={isSelected ? 3 / cam.scale : 2 / cam.scale}
              draggable={!object.locked && interactionsEnabled}
              interactive={interactionsEnabled}
              onDragStart={(event) => handleDragStart(object.id, event)}
              onDragEnd={(event) => handleDrag(object.id, event)}
              onHover={onHover}
              onDoubleClick={() => onRecolorToken(object.id, object.owner)}
              onClick={(event) => {
                if (!onSelectObject) {
                  return;
                }
                const native = event?.evt;
                const append = native?.shiftKey ?? false;
                const toggle = native?.ctrlKey || native?.metaKey || false;
                const mode = append ? "append" : toggle ? "toggle" : "replace";
                if (event) {
                  event.cancelBubble = true;
                }
                onSelectObject(object.id, { mode });
              }}
              onNodeReady={
                onTokenNodeReady ? (node) => onTokenNodeReady(object.id, node) : undefined
              }
            />
            {object.locked && (
              <LockIndicator
                x={object.transform.x * gridSize + gridSize / 2}
                y={object.transform.y * gridSize + gridSize / 2 - gridSize * 0.45}
                size={gridSize * 0.25}
              />
            )}
            {statusEffectsByTokenId[object.id] && (
              <StatusEffectBadge
                x={object.transform.x * gridSize + gridSize * 0.15}
                y={object.transform.y * gridSize + gridSize * 0.15}
                size={gridSize * 0.3}
                emoji={statusEffectsByTokenId[object.id]}
              />
            )}
            {isFirstSelected && (
              <MultiSelectBadge
                x={object.transform.x * gridSize + gridSize * 0.85}
                y={object.transform.y * gridSize + gridSize * 0.15}
                size={gridSize * 0.3}
                count={selectedTokenCount}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
});
