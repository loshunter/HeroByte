import type { MapDocument, MapElement, MapLayer, TerrainPaintCell } from "@herobyte/shared";
import {
  useMemo,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import { getMapStudioTileAsset, type MapStudioTileAsset } from "../starterTiles";
import { buildStructuredTerrainLayers } from "../terrainRender";
import { buildTileOccupancy } from "../tileAutotiling";
import { MapStudioCanvasUnderlay } from "./MapStudioCanvasUnderlay";
import { MapStudioElementPreview, MapStudioSelectionOverlay } from "./MapStudioElementPreview";
import type { MapViewBox, RoomDrag, StudioTool } from "./MapStudioWorkspace.types";
import { canvasShellStyle, errorStyle, statusStyle } from "./mapStudioWorkspaceStyles";
import { roomBoundsFromDrag } from "./mapStudioWorkspaceUtils";

interface MapStudioCanvasProps {
  activeDocument: MapDocument;
  viewBox: MapViewBox;
  tool: StudioTool;
  snappedCursor: { x: number; y: number } | null;
  stampPreview: { x: number; y: number; width: number; height: number } | null;
  strokeCells: TerrainPaintCell[];
  selectedAsset: MapStudioTileAsset;
  previewLayer?: MapLayer;
  roomDrag: RoomDrag | null;
  segmentDrag: RoomDrag | null;
  roomFillAsset: MapStudioTileAsset;
  roomWallAsset: MapStudioTileAsset | null;
  visibleElements: MapElement[];
  layers: Map<string, MapLayer>;
  selectedElementId: string | null;
  error?: string | null;
  publishMessage: string;
  svgRef: RefObject<SVGSVGElement>;
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerEnd: () => void;
  onWheel: (event: WheelEvent<SVGSVGElement>) => void;
  onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
  onSelectElement: (elementId: string) => void;
}

export function MapStudioCanvas({
  activeDocument,
  viewBox,
  tool,
  snappedCursor,
  stampPreview,
  strokeCells,
  selectedAsset,
  previewLayer,
  roomDrag,
  segmentDrag,
  roomFillAsset,
  roomWallAsset,
  visibleElements,
  layers,
  selectedElementId,
  error,
  publishMessage,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onWheel,
  onKeyDown,
  onSelectElement,
}: MapStudioCanvasProps) {
  const autotile = useMemo(
    () => ({ occupancy: buildTileOccupancy(activeDocument), grid: activeDocument.grid }),
    [activeDocument],
  );
  // Painted terrain: structured cells/edges per family for the canvas
  // underlay, honoring the terrain-kind layer's visibility and opacity.
  const terrainKindLayer = activeDocument.layers.find((layer) => layer.kind === "terrain");
  const terrainLayers = useMemo(() => {
    if (!activeDocument.terrain) return [];
    return buildStructuredTerrainLayers(
      activeDocument.terrain,
      activeDocument.grid,
      autotile.occupancy,
    );
  }, [activeDocument, autotile]);
  // Only pay for the animation clock when a painted family actually animates.
  const hasAnimatedTerrain = useMemo(
    () => terrainLayers.some((layer) => Boolean(getMapStudioTileAsset(layer.assetId).animFills)),
    [terrainLayers],
  );
  return (
    <main style={canvasShellStyle}>
      {error && (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      )}
      {publishMessage && (
        <div role="status" style={statusStyle}>
          {publishMessage}
        </div>
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          background: "#151822",
          border: "1px solid #8a7445",
        }}
      >
        {/* Background, grid, and painted terrain draw on the canvas beneath
            the SVG (shared tile-render core); the SVG keeps element handles,
            tool ghosts, and selection. */}
        <MapStudioCanvasUnderlay
          documentWidth={activeDocument.width}
          documentHeight={activeDocument.height}
          grid={activeDocument.grid}
          terrainLayers={terrainLayers}
          terrainOpacity={
            terrainKindLayer?.visible === false ? 0 : (terrainKindLayer?.opacity ?? 1)
          }
          animated={hasAnimatedTerrain}
          viewBox={viewBox}
        />
        <svg
          ref={svgRef}
          aria-label={`${activeDocument.name} studio canvas`}
          role="img"
          tabIndex={0}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            touchAction: "none",
            cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair",
          }}
        >
          {strokeCells.length > 0 && (
            <g opacity={0.55} pointerEvents="none">
              {strokeCells.map((cell) => (
                <rect
                  key={`${cell.x},${cell.y}`}
                  x={activeDocument.grid.offsetX + cell.x * activeDocument.grid.size}
                  y={activeDocument.grid.offsetY + cell.y * activeDocument.grid.size}
                  width={activeDocument.grid.size}
                  height={activeDocument.grid.size}
                  fill={cell.assetId ? getMapStudioTileAsset(cell.assetId).fill : "#10121a"}
                />
              ))}
            </g>
          )}
          {visibleElements.map((element, index) => {
            const layer = layers.get(element.layerId);
            if (!layer) return null;
            const selected = selectedElementId === element.id;
            return (
              <g
                key={element.id}
                aria-label={`Select ${element.type} ${index + 1}`}
                role="button"
                tabIndex={-1}
                onPointerDown={(event) => {
                  if (tool !== "select") return;
                  event.stopPropagation();
                  onSelectElement(element.id);
                }}
              >
                <MapStudioElementPreview
                  element={element}
                  layer={layer}
                  gridSize={activeDocument.grid.size}
                  autotile={autotile}
                />
                {selected && (
                  <MapStudioSelectionOverlay
                    element={element}
                    layer={layer}
                    gridSize={activeDocument.grid.size}
                  />
                )}
              </g>
            );
          })}
          {tool === "tile" && stampPreview && previewLayer && (
            // Alt held: free-placement ghost, centered on the raw cursor.
            <g
              transform={`translate(${stampPreview.x} ${stampPreview.y})`}
              opacity={0.62}
              pointerEvents="none"
            >
              <rect
                width={stampPreview.width}
                height={stampPreview.height}
                fill={selectedAsset.fill}
                stroke="#ffd97f"
                strokeWidth={Math.max(2, activeDocument.grid.size * 0.04)}
                strokeDasharray="4 4"
              />
            </g>
          )}
          {tool === "tile" && !stampPreview && snappedCursor && previewLayer && (
            <g
              transform={`translate(${snappedCursor.x} ${snappedCursor.y})`}
              opacity={0.62}
              pointerEvents="none"
            >
              <rect
                width={selectedAsset.columns * activeDocument.grid.size}
                height={selectedAsset.rows * activeDocument.grid.size}
                fill={selectedAsset.fill}
                stroke="#7fd6ff"
                strokeWidth={Math.max(2, activeDocument.grid.size * 0.04)}
                strokeDasharray="10 6"
              />
            </g>
          )}
          {tool === "room" && roomDrag && (
            <RoomDragPreview
              drag={roomDrag}
              gridSize={activeDocument.grid.size}
              fillAsset={roomFillAsset}
              wallAsset={roomWallAsset}
            />
          )}
          {(tool === "wall" || tool === "door") && segmentDrag && (
            <SegmentDragPreview
              drag={segmentDrag}
              tool={tool}
              gridSize={activeDocument.grid.size}
            />
          )}
        </svg>
      </div>
    </main>
  );
}

function RoomDragPreview({
  drag,
  gridSize,
  fillAsset,
  wallAsset,
}: {
  drag: RoomDrag;
  gridSize: number;
  fillAsset: MapStudioTileAsset;
  wallAsset: MapStudioTileAsset | null;
}) {
  const bounds = roomBoundsFromDrag(drag, gridSize);
  return (
    <g pointerEvents="none" opacity={0.68}>
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill={fillAsset.fill}
        stroke={wallAsset?.fill ?? "#7fd6ff"}
        strokeWidth={wallAsset ? gridSize : Math.max(2, gridSize * 0.05)}
        strokeDasharray={wallAsset ? undefined : "10 6"}
      />
    </g>
  );
}

// Live preview for the Wall/Door two-point drag: the segment being dragged,
// colored to match its baked/live render (wall #e9d8a6, door #c99b55) with
// endpoint dots. Drawn as an overlay, never by mutating element props.
function SegmentDragPreview({
  drag,
  tool,
  gridSize,
}: {
  drag: RoomDrag;
  tool: StudioTool;
  gridSize: number;
}) {
  const color = tool === "door" ? "#c99b55" : "#e9d8a6";
  const strokeWidth = tool === "door" ? Math.max(4, gridSize * 0.16) : Math.max(3, gridSize * 0.1);
  const dotRadius = Math.max(3, gridSize * 0.06);
  return (
    <g pointerEvents="none" opacity={0.75}>
      <line
        x1={drag.start.x}
        y1={drag.start.y}
        x2={drag.end.x}
        y2={drag.end.y}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="10 6"
      />
      <circle cx={drag.start.x} cy={drag.start.y} r={dotRadius} fill={color} />
      <circle cx={drag.end.x} cy={drag.end.y} r={dotRadius} fill={color} />
    </g>
  );
}
