// ============================================================================
// MAP-EDIT PREVIEW LAYER
// ============================================================================
// Konva preview of the in-progress map-edit drag, rendered inside MapBoard's
// non-listening overlay Layer. Nests the same camera + map-transform groups as
// the compiled-scene layers so the preview sits in document space; stroke and
// dot sizes divide by cam.scale so they stay constant on screen at any zoom.

import { Group, Line, Circle } from "react-konva";
import type { SceneObjectTransform } from "@herobyte/shared";
import type { Camera } from "../map/types";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapEditSubTool } from "./mapEditTypes";

interface MapEditPreviewLayerProps {
  cam: Camera;
  mapTransform?: SceneObjectTransform;
  previewDrag: RoomDrag | null;
  activeSubTool: MapEditSubTool;
}

const PREVIEW_COLOR = "#f0e2c3"; // hero gold — reads over any floor

export function MapEditPreviewLayer({
  cam,
  mapTransform,
  previewDrag,
  activeSubTool,
}: MapEditPreviewLayerProps) {
  if (!previewDrag) return null;

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};
  const { start, end } = previewDrag;
  const strokeWidth = 3 / cam.scale;
  const dotRadius = 4 / cam.scale;
  const dash = [8 / cam.scale, 6 / cam.scale];

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation} listening={false}>
        <Line
          points={[start.x, start.y, end.x, end.y]}
          stroke={PREVIEW_COLOR}
          strokeWidth={strokeWidth}
          dash={dash}
          lineCap="round"
          listening={false}
          name={`map-edit-preview:${activeSubTool}`}
        />
        <Circle x={start.x} y={start.y} radius={dotRadius} fill={PREVIEW_COLOR} listening={false} />
        <Circle x={end.x} y={end.y} radius={dotRadius} fill={PREVIEW_COLOR} listening={false} />
      </Group>
    </Group>
  );
}
