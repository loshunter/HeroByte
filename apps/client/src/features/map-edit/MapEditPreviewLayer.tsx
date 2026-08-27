// ============================================================================
// MAP-EDIT PREVIEW LAYER
// ============================================================================
// Konva preview of the in-progress map-edit drag, rendered inside MapBoard's
// non-listening overlay Layer. Nests the same camera + map-transform groups as
// the compiled-scene layers so the preview sits in document space; stroke, dot,
// and text sizes divide by cam.scale so they stay constant on screen at any
// zoom. Ghost-before-commit (P2): every gesture previews the TRUE result —
// spline drags paint the real sagged rope/ribbon art (the same splineDetail
// painter the committed element uses), paint strokes and the room/hallway fill
// tint with the armed family's real baked chip (brushThumbnails), and
// scatter/populate draft footprints land exactly where the commit will.
// Segment tools (wall/door) keep the dashed line + endpoint dots. The render
// primitives live in MapEditPreviewParts (structure cap).

import { useEffect, useSyncExternalStore } from "react";
import { Circle, Group, Line, Rect } from "react-konva";
import type { SceneObjectTransform, TerrainPaintCell } from "@herobyte/shared";
import type { Camera } from "../map/types";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import type { PlacementGhost } from "./useMapEditPlacement";

/** One colour for every selection outline, whatever shape it takes. */
const SELECTION_STROKE = "#57d6ff";
import { hallwayBoundsFromDrag } from "./hallwayBuilder";
import type { SelectionShape } from "./elementHitTest";
import type { MapEditSplineKind, MapEditSubTool } from "./mapEditTypes";
import {
  getBrushThumbnailVersion,
  requestBrushThumbnails,
  subscribeBrushThumbnails,
} from "./brushThumbnails";
import {
  PREVIEW_COLOR,
  familyGhostFill,
  goldFill,
  renderGhost,
  renderRoom,
  renderSegment,
  renderSplineArt,
  renderStrokeCell,
} from "./MapEditPreviewParts";

interface MapEditPreviewLayerProps {
  cam: Camera;
  mapTransform?: SceneObjectTransform;
  previewDrag: RoomDrag | null;
  activeSubTool: MapEditSubTool;
  gridSize: number;
  /** Corridor width in cells for the hallway preview. */
  hallwayWidth?: number;
  /** In-progress terrain/erase brush cells (real family-chip tint). */
  strokeCells?: TerrainPaintCell[];
  /** Translucent footprint preview for the place/scatter tools. */
  placementGhost?: PlacementGhost | null;
  /** True-result draft footprints (scatter cluster, populate preview). */
  draftGhosts?: PlacementGhost[];
  /** Highlight footprint around the selected element (select sub-tool). */
  selectionShape?: SelectionShape | null;
  /** Armed spline curve kind — the drag paints the REAL splineDetail art. */
  splineKind?: MapEditSplineKind;
  /** Armed paint family — the room/hallway fill uses its real baked chip. */
  floorFamily?: string;
  gridOffsetX?: number;
  gridOffsetY?: number;
}

export function MapEditPreviewLayer({
  cam,
  mapTransform,
  previewDrag,
  activeSubTool,
  gridSize,
  hallwayWidth = 2,
  strokeCells = [],
  placementGhost = null,
  draftGhosts = [],
  selectionShape = null,
  splineKind = "rope",
  floorFamily,
  gridOffsetX = 0,
  gridOffsetY = 0,
}: MapEditPreviewLayerProps) {
  // Re-render when a chip bake lands so ghosts upgrade from flat fill to art.
  useSyncExternalStore(subscribeBrushThumbnails, getBrushThumbnailVersion, () => 0);
  const familyAssetId = floorFamily ? `terrain:${floorFamily}` : null;
  const wantedKey = [
    ...new Set(
      [familyAssetId, ...strokeCells.map((cell) => cell.assetId)].filter(
        (id): id is string => id !== null,
      ),
    ),
  ].join(",");
  useEffect(() => {
    if (wantedKey) requestBrushThumbnails(wantedKey.split(","));
  }, [wantedKey]);

  if (
    !previewDrag &&
    strokeCells.length === 0 &&
    !placementGhost &&
    draftGhosts.length === 0 &&
    !selectionShape
  ) {
    return null;
  }

  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0 } = mapTransform ?? {};
  const strokeWidth = 3 / cam.scale;
  const dash = [8 / cam.scale, 6 / cam.scale];

  return (
    <Group x={cam.x} y={cam.y} scaleX={cam.scale} scaleY={cam.scale} listening={false}>
      <Group x={x} y={y} scaleX={scaleX} scaleY={scaleY} rotation={rotation} listening={false}>
        {placementGhost && renderGhost(placementGhost, cam.scale)}
        {draftGhosts.map((ghost, index) => (
          <Group key={index} listening={false}>
            {renderGhost(ghost, cam.scale)}
          </Group>
        ))}
        {selectionShape?.kind === "rect" && (
          <Group
            x={selectionShape.x + selectionShape.pivotX}
            y={selectionShape.y + selectionShape.pivotY}
            offsetX={selectionShape.pivotX}
            offsetY={selectionShape.pivotY}
            rotation={selectionShape.rotation}
            listening={false}
          >
            <Rect
              width={selectionShape.width}
              height={selectionShape.height}
              stroke={SELECTION_STROKE}
              strokeWidth={2 / cam.scale}
              dash={[6 / cam.scale, 4 / cam.scale]}
              listening={false}
              name="map-edit-preview:selection"
            />
          </Group>
        )}
        {/* A wall, door or spline traced along its own geometry. A bounding box
            would be actively misleading here: the box of a diagonal wall is a
            large square touching it at two corners. The points come from the
            same function the hit test measures, so the outline always shows
            what is really grabbable. */}
        {selectionShape?.kind === "polyline" && (
          <Line
            points={selectionShape.points.flatMap((p) => [p.x, p.y])}
            stroke={SELECTION_STROKE}
            strokeWidth={4 / cam.scale}
            dash={[6 / cam.scale, 4 / cam.scale]}
            lineCap="round"
            lineJoin="round"
            listening={false}
            name="map-edit-preview:selection"
          />
        )}
        {/* A light or text: drawn at exactly the hit tolerance, so the ring IS
            the grab area. Worth the honesty — an unlit light renders nothing at
            all, and this circle is the only thing telling a DM what they picked. */}
        {selectionShape?.kind === "point" && (
          <Circle
            x={selectionShape.x}
            y={selectionShape.y}
            radius={selectionShape.radius}
            stroke={SELECTION_STROKE}
            strokeWidth={2 / cam.scale}
            dash={[6 / cam.scale, 4 / cam.scale]}
            listening={false}
            name="map-edit-preview:selection"
          />
        )}
        {previewDrag &&
          (activeSubTool === "room" || activeSubTool === "generate" ? (
            // Generate aims at the same cell-quantized rectangle a room does —
            // it just fills it with a dungeon instead of one floor, so only
            // the room fill tints with the armed family's chip.
            renderRoom(
              previewDrag.start,
              previewDrag.end,
              gridSize,
              strokeWidth,
              dash,
              cam.scale,
              activeSubTool === "room" ? familyGhostFill(familyAssetId, gridSize) : goldFill(),
            )
          ) : activeSubTool === "hallway" ? (
            <Rect
              {...hallwayBoundsFromDrag(previewDrag, hallwayWidth, {
                size: gridSize,
                offsetX: gridOffsetX,
                offsetY: gridOffsetY,
              })}
              stroke={PREVIEW_COLOR}
              strokeWidth={strokeWidth}
              dash={dash}
              {...familyGhostFill(familyAssetId, gridSize)}
              listening={false}
              name="map-edit-preview:hallway"
            />
          ) : activeSubTool === "spline" ? (
            renderSplineArt(previewDrag.start, previewDrag.end, splineKind, gridSize)
          ) : (
            renderSegment(
              previewDrag.start,
              previewDrag.end,
              strokeWidth,
              dash,
              cam.scale,
              activeSubTool,
            )
          ))}
        {strokeCells.map((cell) => renderStrokeCell(cell, gridSize, gridOffsetX, gridOffsetY))}
      </Group>
    </Group>
  );
}
