// ============================================================================
// MAP-EDIT PREVIEW PARTS
// ============================================================================
// The render helpers behind MapEditPreviewLayer's ghost-before-commit visuals
// (P2), extracted so the layer stays under the structure cap: the family-chip
// fill props, the true spline art, and the segment/room/ghost primitives.

import { Group, Line, Circle, Rect, Shape, Text } from "react-konva";
import type { TerrainPaintCell } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import { paintSpline } from "../render/splineDetail";
import type { WearStampContext2D } from "../render/wearStampDetail";
import type { PlacementGhost } from "./useMapEditPlacement";
import type { MapEditSplineKind, MapEditSubTool } from "./mapEditTypes";
import { BRUSH_CHIP_CELL, peekBrushChip } from "./brushThumbnails";

export const PREVIEW_COLOR = "#f0e2c3"; // hero gold — reads over any floor
const ERASE_COLOR = "#10121a"; // dark — erase preview (Studio's look)
/** Fixed ghost seed: the committed element re-seeds from its id, so detail
 * jitter differs, but the structure (sag, posts, band) is the true result. */
const SPLINE_PREVIEW_SEED = 7;

/** Konva pattern props for a baked chip. Konva's RectConfig types the pattern
 * as HTMLImageElement, but the runtime hands it straight to createPattern,
 * which takes any CanvasImageSource — the cast is type-narrowing only. */
function chipPatternProps(chip: HTMLCanvasElement, gridSize: number, opacity: number) {
  const patternScale = gridSize / BRUSH_CHIP_CELL;
  return {
    fillPatternImage: chip as unknown as HTMLImageElement,
    fillPatternScaleX: patternScale,
    fillPatternScaleY: patternScale,
    // Anchor on the chip's interior centre cell (the corners carry rim art).
    fillPatternOffsetX: BRUSH_CHIP_CELL,
    fillPatternOffsetY: BRUSH_CHIP_CELL,
    fillPatternRepeat: "repeat",
    opacity,
  };
}

/** The armed family's real baked art as a Konva fill-pattern prop set; the
 * family's flat base colour until (or in place of) the bake. One chip cell
 * scales to one document cell. */
export function familyGhostFill(familyAssetId: string | null, gridSize: number) {
  if (!familyAssetId) return goldFill();
  const chip = peekBrushChip(familyAssetId);
  if (!chip) return { fill: getMapStudioTileAsset(familyAssetId).fill, opacity: 0.3 };
  return chipPatternProps(chip, gridSize, 0.4);
}

export function goldFill() {
  return { fill: PREVIEW_COLOR, opacity: 0.15 };
}

/** One in-progress brush cell: erase stays dark; paint tints with the REAL
 * family chip (base+mottle+detail), or the family's flat base while baking. */
export function renderStrokeCell(
  cell: TerrainPaintCell,
  gridSize: number,
  gridOffsetX: number,
  gridOffsetY: number,
) {
  const key = `${cell.x},${cell.y}`;
  const at = {
    x: cell.x * gridSize + gridOffsetX,
    y: cell.y * gridSize + gridOffsetY,
    width: gridSize,
    height: gridSize,
    listening: false as const,
  };
  if (cell.assetId === null) {
    return <Rect key={key} {...at} fill={ERASE_COLOR} opacity={0.55} />;
  }
  const chip = peekBrushChip(cell.assetId);
  if (!chip) {
    return (
      <Rect key={key} {...at} fill={getMapStudioTileAsset(cell.assetId).fill} opacity={0.55} />
    );
  }
  return <Rect key={key} {...at} {...chipPatternProps(chip, gridSize, 0.75)} />;
}

/** The spline drag's TRUE art: the same deterministic splineDetail painter
 * the committed element renders with (sagged rope/chain spans hang posts;
 * ribbon/filigree sweep the smooth band). */
export function renderSplineArt(
  start: { x: number; y: number },
  end: { x: number; y: number },
  kind: MapEditSplineKind,
  gridSize: number,
) {
  return (
    <Shape
      listening={false}
      opacity={0.9}
      name="map-edit-preview:spline-art"
      sceneFunc={(ctx) =>
        paintSpline(
          ctx as unknown as WearStampContext2D,
          [start, end],
          kind,
          SPLINE_PREVIEW_SEED,
          gridSize,
        )
      }
    />
  );
}

/**
 * The place/scatter ghost: a translucent footprint at the cursor. A ghost is
 * always a tile/stamp footprint, so it rotates about its VISUAL CENTER — matching
 * MapElementsLayer's corrected footprint render (center-pivot via position +
 * offset) so the preview lands exactly where the committed element will.
 */
export function renderGhost(ghost: PlacementGhost, scale: number) {
  return (
    <Group
      x={ghost.x + ghost.width / 2}
      y={ghost.y + ghost.height / 2}
      offsetX={ghost.width / 2}
      offsetY={ghost.height / 2}
      rotation={ghost.rotation}
      listening={false}
    >
      <Rect
        width={ghost.width}
        height={ghost.height}
        fill={ghost.fill}
        stroke={ghost.stroke}
        strokeWidth={2 / scale}
        opacity={0.5}
        listening={false}
        name="map-edit-preview:ghost"
      />
    </Group>
  );
}

export function renderSegment(
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

export function renderRoom(
  start: { x: number; y: number },
  end: { x: number; y: number },
  gridSize: number,
  strokeWidth: number,
  dash: number[],
  scale: number,
  fillProps: Record<string, unknown>,
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
        {...fillProps}
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
