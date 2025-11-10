/**
 * StagingZoneLayer Component
 *
 * Renders the staging zone visualization on the map canvas.
 * The staging zone is a designated area where tokens can be prepared
 * before being placed on the main map.
 *
 * Features:
 * - Renders a dashed rectangle with label
 * - Camera-aware scaling (stroke width, dash pattern, font size)
 * - Interactive when DM is in select or transform mode
 * - Registers Konva node for transform gizmo integration
 *
 * Extracted from: MapBoard.tsx:565-615
 */

import { Group, Rect, Text } from "react-konva";
import type { StagingZoneDimensions, StagingZoneSceneObject } from "../../../hooks/useSceneObjectsData";

export interface StagingZoneLayerProps {
  /** Camera state for positioning and scaling */
  cam: { x: number; y: number; scale: number };
  /** Calculated dimensions for the staging zone */
  stagingZoneDimensions: StagingZoneDimensions | null;
  /** Staging zone scene object data */
  stagingZoneObject: StagingZoneSceneObject | null;
  /** Whether the current user is the DM */
  isDM: boolean;
  /** Whether select mode is active */
  selectMode: boolean;
  /** Whether transform mode is active */
  transformMode: boolean;
  /** Callback when the staging zone is selected */
  onSelectObject?: (id: string) => void;
  /** Callback to register the Konva node reference */
  registerNode: (id: string, node: unknown) => void;
}

/**
 * StagingZoneLayer renders the staging zone visualization.
 *
 * The staging zone is only rendered when both dimensions and object data are present.
 * It consists of a dashed rectangle with a label positioned above it.
 *
 * The component applies camera transforms to maintain consistent visual appearance
 * at different zoom levels (stroke width, dash pattern, and font size are all scaled).
 */
export function StagingZoneLayer({
  cam,
  stagingZoneDimensions,
  stagingZoneObject,
  isDM,
  selectMode,
  transformMode,
  onSelectObject,
  registerNode,
}: StagingZoneLayerProps) {
  // Don't render if data is missing
  if (!stagingZoneDimensions || !stagingZoneObject) {
    return null;
  }

  // Interactive only when DM and in select or transform mode
  const interactive = isDM && (selectMode || transformMode);

  // Click handler for selection
  const handleClick = (e: { cancelBubble: boolean }) => {
    if (interactive) {
      e.cancelBubble = true;
      onSelectObject?.(stagingZoneObject.id);
    }
  };

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale}>
      <Group
        x={stagingZoneDimensions.centerX}
        y={stagingZoneDimensions.centerY}
        rotation={stagingZoneDimensions.rotation}
        scaleX={stagingZoneObject.transform.scaleX || 1}
        scaleY={stagingZoneObject.transform.scaleY || 1}
        ref={(node) => {
          if (stagingZoneObject) {
            registerNode(stagingZoneObject.id, node);
          }
        }}
      >
        <Rect
          x={-stagingZoneDimensions.widthPx / 2}
          y={-stagingZoneDimensions.heightPx / 2}
          width={stagingZoneDimensions.widthPx}
          height={stagingZoneDimensions.heightPx}
          stroke="rgba(77, 229, 192, 0.75)"
          strokeWidth={2 / cam.scale}
          dash={[8 / cam.scale, 6 / cam.scale]}
          fill="rgba(77, 229, 192, 0.12)"
          cornerRadius={8 / cam.scale}
          listening={interactive}
          onClick={handleClick}
          onTap={handleClick}
        />
        <Text
          text={stagingZoneDimensions.label}
          fontSize={14 / cam.scale}
          fill="#4de5c0"
          align="center"
          width={stagingZoneDimensions.widthPx}
          x={-stagingZoneDimensions.widthPx / 2}
          y={-stagingZoneDimensions.heightPx / 2 - 18 / cam.scale}
          listening={false}
        />
      </Group>
    </Group>
  );
}
