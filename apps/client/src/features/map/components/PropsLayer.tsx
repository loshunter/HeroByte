// ============================================================================
// PROPS LAYER COMPONENT
// ============================================================================
// Renders props from the unified scene graph.

import { memo } from "react";
import { Group, Rect, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { SceneObject } from "@shared";
import useImage from "use-image";
import type { Camera } from "../types";
import { LockIndicator } from "./LockIndicator";

interface PropsSpriteProps {
  object: SceneObject & { type: "prop" };
  gridSize: number;
  interactive: boolean;
  cam: Camera;
  isSelected: boolean;
  onClick?: (event: any) => void;
  onNodeReady?: (node: Konva.Node | null) => void;
  onDragEnd?: (event: any) => void;
}

const PropSprite = memo(function PropSprite({ object, gridSize, interactive, cam, isSelected, onClick, onNodeReady, onDragEnd }: PropsSpriteProps) {
  const { data, transform, locked } = object;
  const [image, status] = useImage(data.imageUrl);

  // Calculate size multiplier based on size category (same as tokens)
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
    listening: interactive,
    draggable: !locked && interactive,
    stroke: isSelected ? "#447DF7" : "transparent",
    strokeWidth: isSelected ? 4 / cam.scale : 0,
    onClick: onClick,
    onDragEnd: onDragEnd,
    id: object.id,
    name: object.id,
    ref: (node: Konva.Node | null) => {
      if (onNodeReady) {
        onNodeReady(node);
      }
    },
  };

  return (
    <Group>
      {/* Render image if loaded, otherwise show placeholder */}
      {status === "loaded" && image ? (
        <KonvaImage {...commonProps} image={image} />
      ) : (
        <Rect
          {...commonProps}
          fill="#888888"
          cornerRadius={4}
          opacity={0.5}
        />
      )}

      {/* Lock indicator */}
      {locked && (
        <LockIndicator
          x={commonProps.x + size - 12}
          y={commonProps.y + 4}
          size={16}
          rotation={-transform.rotation}
        />
      )}
    </Group>
  );
});

interface PropsLayerProps {
  cam: Camera;
  sceneObjects: SceneObject[];
  gridSize: number;
  interactive: boolean;
  selectedObjectId?: string | null;
  selectedObjectIds?: string[];
  onSelectObject?: (
    objectId: string | null,
    options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
  ) => void;
  onPropNodeReady?: (propId: string, node: Konva.Node | null) => void;
  onTransformProp?: (propId: string, position: { x: number; y: number }) => void;
}

export const PropsLayer = memo(function PropsLayer({
  cam,
  sceneObjects,
  gridSize,
  interactive,
  selectedObjectId,
  selectedObjectIds = [],
  onSelectObject,
  onPropNodeReady,
  onTransformProp,
}: PropsLayerProps) {
  const propObjects = sceneObjects.filter((obj): obj is SceneObject & { type: "prop" } => obj.type === "prop");

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      {propObjects.map((obj) => {
        const isSelected = selectedObjectIds.includes(obj.id) || selectedObjectId === obj.id;
        return (
          <PropSprite
            key={obj.id}
            object={obj}
            gridSize={gridSize}
            interactive={interactive}
            cam={cam}
            isSelected={isSelected}
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
              onSelectObject(obj.id, { mode });
            }}
            onDragEnd={(event) => {
              if (!onTransformProp) return;
              const target = event.target;
              const newX = (target.x() + target.width() / 2) / gridSize;
              const newY = (target.y() + target.height() / 2) / gridSize;
              onTransformProp(obj.id, { x: newX, y: newY });
            }}
            onNodeReady={onPropNodeReady ? (node) => onPropNodeReady(obj.id, node) : undefined}
          />
        );
      })}
    </Group>
  );
});
