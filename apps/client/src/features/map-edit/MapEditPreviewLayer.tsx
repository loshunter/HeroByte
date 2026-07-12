// ============================================================================
// MAP-EDIT PREVIEW LAYER
// ============================================================================
// Konva preview of the in-progress map-edit drag, rendered inside MapBoard's
// non-listening overlay Layer. Nests the same camera + map-transform groups as
// the compiled-scene layers so the preview sits in document space; stroke, dot,
// and text sizes divide by cam.scale so they stay constant on screen at any
// zoom. Segment tools (wall/door) draw a dashed line + endpoint dots; the room
// tool draws a dashed rectangle + a "cols × rows" cell-count label.

import { Group, Line, Circle, Rect, Text } from "react-konva";
import type { SceneObjectTransform } from "@herobyte/shared";
import type { Camera } from "../map/types";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapEditSubTool } from "./mapEditTypes";

interface MapEditPreviewLayerProps {
  cam: Camera;
  mapTransform?: SceneObjectTransform;
  previewDrag: RoomDrag | null;
  activeSubTool: MapEditSubTool;
  gridSize: number;
}

const PREVIEW_COLOR = "#f0e2c3"; // hero gold — reads over any floor

export function MapEditPreviewLayer({
  cam,
  mapTransform,
  previewDrag,
  activeSubTool,
  gridSize,
}: MapEditPreviewLayerProps) {
  if (!previewDrag) return null;

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};
  const { start, end } = previewDrag;
  const strokeWidth = 3 / cam.scale;
  const dash = [8 / cam.scale, 6 / cam.scale];

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation} listening={false}>
        {activeSubTool === "room"
          ? renderRoom(start, end, gridSize, strokeWidth, dash, cam.scale)
          : renderSegment(start, end, strokeWidth, dash, cam.scale, activeSubTool)}
      </Group>
    </Group>
  );
}

function renderSegment(
  start: { x: number; y: number },
  end: { x: number; y: number },
  strokeWidth: number,
  dash: number[],
  scale: number,
  activeSubTool: MapEditSubTool,
) {
  const dotRadius = 4 / scale;
  return (
    <>
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
    </>
  );
}

function renderRoom(
  start: { x: number; y: number },
  end: { x: number; y: number },
  gridSize: number,
  strokeWidth: number,
  dash: number[],
  scale: number,
) {
  // Inclusive of both endpoint cells — mirrors roomBoundsFromDrag.
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x) + gridSize;
  const height = Math.abs(end.y - start.y) + gridSize;
  const cols = Math.max(1, Math.round(width / gridSize));
  const rows = Math.max(1, Math.round(height / gridSize));
  const fontSize = 14 / scale;

  return (
    <>
      <Rect
        x={left}
        y={top}
        width={width}
        height={height}
        stroke={PREVIEW_COLOR}
        strokeWidth={strokeWidth}
        dash={dash}
        fill={PREVIEW_COLOR}
        opacity={0.15}
        listening={false}
        name="map-edit-preview:room"
      />
      <Text
        x={left + 4 / scale}
        y={top + 4 / scale}
        text={`${cols} × ${rows}`}
        fontSize={fontSize}
        fill={PREVIEW_COLOR}
        listening={false}
      />
    </>
  );
}
