// ============================================================================
// TOKENS LAYER COMPONENT (SCENE OBJECT VERSION)
// ============================================================================
// Renders tokens from the unified scene graph with drag support.

import { memo, useEffect, useRef, useState } from "react";
import { Group, Rect, Image as KonvaImage } from "react-konva";
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
  draggable?: boolean;
  onDragEnd?: (event: KonvaEventObject<DragEvent>) => void;
  onDragStart?: (event: KonvaEventObject<DragEvent>) => void;
  onHover: (id: string | null) => void;
  onDoubleClick?: () => void;
}

const TokenSprite = memo(function TokenSprite({
  object,
  gridSize,
  stroke,
  strokeWidth,
  draggable = false,
  onDragEnd,
  onDragStart,
  onHover,
  onDoubleClick,
}: TokenSpriteProps) {
  const { data, transform, id } = object;
  const [image, status] = useImage(data.imageUrl ?? "", "anonymous");

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
    onDblClick: onDoubleClick,
  } as const;

  if (data.imageUrl && status === "loaded" && image) {
    return <KonvaImage image={image} {...commonProps} />;
  }

  return <Rect fill={data.color} {...commonProps} />;
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
}: TokensLayerProps) {
  const localOverrides = useRef<Record<string, { x: number; y: number }>>({});
  const [, forceRerender] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const tokens = sceneObjects.filter((object): object is SceneObject & { type: "token" } => {
    return object.type === "token";
  });

  const myTokens = tokens.filter((object) => object.owner === uid);
  const otherTokens = tokens.filter((object) => object.owner !== uid);

  const handleDrag = (sceneId: string, event: KonvaEventObject<DragEvent>) => {
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

    localOverrides.current[sceneId] = { x: gx, y: gy };
    forceRerender((value) => value + 1);

    onTransformToken(sceneId, { x: gx, y: gy });
    setDraggingId(null);
  };

  const handleDragStart = (sceneId: string) => {
    setDraggingId(sceneId);
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
      {otherTokens.map((object) => (
        <Group key={object.id}>
          <TokenSprite
            object={mapOverrides(object)}
            gridSize={gridSize}
            stroke={hoveredTokenId === object.id ? "#aaa" : "transparent"}
            strokeWidth={2 / cam.scale}
            onHover={onHover}
          />
          {object.locked && (
            <LockIndicator
              x={object.transform.x * gridSize + gridSize / 2}
              y={object.transform.y * gridSize + gridSize / 2 - gridSize * 0.45}
              size={gridSize * 0.25}
            />
          )}
        </Group>
      ))}

      {myTokens.map((object) => (
        <Group key={object.id}>
          <TokenSprite
            object={mapOverrides(object)}
            gridSize={gridSize}
            stroke={draggingId === object.id ? "#44f" : "#fff"}
            strokeWidth={2 / cam.scale}
            draggable={!object.locked}
            onDragStart={() => handleDragStart(object.id)}
            onDragEnd={(event) => handleDrag(object.id, event)}
            onHover={onHover}
            onDoubleClick={() => onRecolorToken(object.id, object.owner)}
          />
          {object.locked && (
            <LockIndicator
              x={object.transform.x * gridSize + gridSize / 2}
              y={object.transform.y * gridSize + gridSize / 2 - gridSize * 0.45}
              size={gridSize * 0.25}
            />
          )}
        </Group>
      ))}
    </Group>
  );
});
