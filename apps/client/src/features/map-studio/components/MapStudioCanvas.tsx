import type { MapDocument, MapElement, MapLayer, TerrainPaintCell } from "@herobyte/shared";
import {
  useMemo,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import { getMapStudioTileAsset, type MapStudioTileAsset } from "../starterTiles";
import { buildTerrainRenderLayers } from "../terrainRender";
import { buildTileOccupancy } from "../tileAutotiling";
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
  // Painted terrain: one fill + boundary path per family, honoring the
  // terrain-kind layer's visibility and opacity.
  const terrainKindLayer = activeDocument.layers.find((layer) => layer.kind === "terrain");
  const terrainLayers = useMemo(() => {
    if (!activeDocument.terrain) return [];
    return buildTerrainRenderLayers(
      activeDocument.terrain,
      activeDocument.grid,
      autotile.occupancy,
    );
  }, [activeDocument, autotile]);
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
          width: "100%",
          height: "100%",
          background: "#151822",
          border: "1px solid #8a7445",
          touchAction: "none",
          cursor: tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair",
        }}
      >
        <defs>
          <pattern
            id={`studio-grid-${activeDocument.id}`}
            width={activeDocument.grid.size}
            height={activeDocument.grid.size}
            patternUnits="userSpaceOnUse"
            x={activeDocument.grid.offsetX}
            y={activeDocument.grid.offsetY}
          >
            <path
              d={`M ${activeDocument.grid.size} 0 L 0 0 0 ${activeDocument.grid.size}`}
              fill="none"
              stroke="rgba(127,214,255,0.22)"
              strokeWidth={Math.max(1, activeDocument.grid.size / 48)}
            />
          </pattern>
        </defs>
        <rect
          width={activeDocument.width}
          height={activeDocument.height}
          fill="#24212b"
          pointerEvents="none"
        />
        {activeDocument.grid.visible && (
          <rect
            width={activeDocument.width}
            height={activeDocument.height}
            fill={`url(#studio-grid-${activeDocument.id})`}
            pointerEvents="none"
          />
        )}
        {terrainKindLayer?.visible !== false &&
          terrainLayers.map((layer) => {
            const asset = getMapStudioTileAsset(layer.assetId);
            return (
              <g
                key={layer.assetId}
                data-terrain={layer.assetId}
                opacity={terrainKindLayer?.opacity ?? 1}
                pointerEvents="none"
              >
                <path d={layer.fillPath} fill={asset.fill} />
                {layer.boundaryPath && (
                  <path
                    d={layer.boundaryPath}
                    fill="none"
                    stroke={asset.stroke}
                    strokeWidth={Math.max(2, activeDocument.grid.size * 0.04)}
                  />
                )}
              </g>
            );
          })}
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
      </svg>
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
