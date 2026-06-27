import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type {
  MapDocument,
  MapElement,
  MapElementTransform,
  MapElementUpdate,
  MapLayer,
} from "@herobyte/shared";
import { MapElementInspector } from "./MapElementInspector";
import { MapStudioElementPreview, MapStudioSelectionOverlay } from "./MapStudioElementPreview";
import { getGridGeometry } from "../../../map-studio/gridGeometry";
import { mapKeyboardNudgeStep, snapPointToGrid } from "../../../map-studio/snapToGrid";

interface MapStudioCanvasProps {
  document: MapDocument;
  disabled: boolean;
  onRemoveElement: (elementId: string) => void;
  onUpdateElement: (elementId: string, update: MapElementUpdate) => void;
}

export function MapStudioCanvas({
  document,
  disabled,
  onRemoveElement,
  onUpdateElement,
}: MapStudioCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const layers = new Map(document.layers.map((layer) => [layer.id, layer]));
  const visibleElements = document.elements
    .filter((element) => isVisible(element, layers.get(element.layerId)))
    .sort((a, b) => layerOrder(layers.get(a.layerId)) - layerOrder(layers.get(b.layerId)));
  const patternId = `map-grid-${document.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const grid = getGridGeometry(document.grid.type, document.grid.size);
  const selectedElement = document.elements.find((element) => element.id === selectedId);
  const selectedLayer = selectedElement ? layers.get(selectedElement.layerId) : undefined;
  const selectedCanMove = Boolean(
    selectedElement && !disabled && !selectedElement.locked && !selectedLayer?.locked,
  );

  const commitTransform = (element: MapElement, transform: MapElementTransform) => {
    if (sameTransform(element.transform, transform)) return;
    onUpdateElement(element.id, { transform });
  };

  const handlePointerDown = (
    event: PointerEvent<SVGGElement>,
    element: MapElement,
    layer?: MapLayer,
  ) => {
    setSelectedId(element.id);
    if (disabled || element.locked || layer?.locked) return;
    const point = eventToMapPoint(event, document, svgRef.current);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      id: element.id,
      pointerId: event.pointerId,
      startPoint: point,
      initialTransform: element.transform,
      currentTransform: element.transform,
    });
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = eventToMapPoint(event, document, svgRef.current);
    const snapped = snapPointToGrid(
      {
        x: drag.initialTransform.x + point.x - drag.startPoint.x,
        y: drag.initialTransform.y + point.y - drag.startPoint.y,
      },
      document.grid,
    );
    setDrag({
      ...drag,
      currentTransform: { ...drag.initialTransform, x: snapped.x, y: snapped.y },
    });
  };

  const handlePointerEnd = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const element = document.elements.find((candidate) => candidate.id === drag.id);
    setDrag(null);
    if (element) commitTransform(element, drag.currentTransform);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!selectedElement || !selectedCanMove) return;
    const delta = keyDelta(event.key);
    if (!delta) return;
    event.preventDefault();
    const step = mapKeyboardNudgeStep(document.grid, event.shiftKey);
    commitTransform(selectedElement, {
      ...selectedElement.transform,
      x: selectedElement.transform.x + delta.x * step,
      y: selectedElement.transform.y + delta.y * step,
    });
  };

  return (
    <div>
      <svg
        ref={svgRef}
        aria-label={`${document.name} map preview`}
        role="img"
        tabIndex={0}
        viewBox={`0 0 ${document.width} ${document.height}`}
        onKeyDown={handleKeyDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          width: "100%",
          maxHeight: "260px",
          background: "#16151b",
          border: "1px solid #8a7445",
        }}
      >
        <defs>
          <pattern
            id={patternId}
            width={grid.width}
            height={grid.height}
            patternUnits="userSpaceOnUse"
            x={document.grid.offsetX}
            y={document.grid.offsetY}
          >
            <path
              d={grid.path}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={Math.max(1, document.width / 1000)}
            />
          </pattern>
        </defs>
        <rect width={document.width} height={document.height} fill="#24212b" />
        {document.grid.visible && (
          <rect width={document.width} height={document.height} fill={`url(#${patternId})`} />
        )}
        {visibleElements.map((element, index) => {
          const layer = layers.get(element.layerId)!;
          const previewElement =
            drag?.id === element.id ? { ...element, transform: drag.currentTransform } : element;
          const selected = selectedId === element.id;
          const canMove = !disabled && !element.locked && !layer.locked;
          return (
            <g
              key={element.id}
              aria-label={`Select ${element.type} ${index + 1}`}
              role="button"
              tabIndex={-1}
              onClick={() => setSelectedId(element.id)}
              onPointerDown={(event) => handlePointerDown(event, element, layer)}
              style={{ cursor: canMove ? "grab" : "default" }}
            >
              <MapStudioElementPreview element={previewElement} layer={layer} />
              {selected && <MapStudioSelectionOverlay element={previewElement} layer={layer} />}
            </g>
          );
        })}
      </svg>

      {document.elements.length > 0 && (
        <div
          aria-label="Map elements"
          style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}
        >
          {document.elements.map((element, index) => (
            <div key={element.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="jrpg-text-small" style={{ flex: 1 }}>
                {element.type.toUpperCase()} {index + 1} · {layers.get(element.layerId)?.name}
              </span>
              <button
                aria-label={`Edit ${element.type} ${index + 1}`}
                disabled={disabled}
                onClick={() => setSelectedId(element.id)}
              >
                ✎
              </button>
              <button
                aria-label={`Delete ${element.type} ${index + 1}`}
                disabled={disabled || element.locked || layers.get(element.layerId)?.locked}
                onClick={() => onRemoveElement(element.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {selectedElement && (
        <MapElementInspector
          element={selectedElement}
          layers={document.layers}
          disabled={disabled || layers.get(selectedElement.layerId)?.locked === true}
          onUpdate={onUpdateElement}
        />
      )}
    </div>
  );
}

interface DragState {
  id: string;
  pointerId: number;
  startPoint: { x: number; y: number };
  initialTransform: MapElementTransform;
  currentTransform: MapElementTransform;
}

function eventToMapPoint(
  event: PointerEvent,
  document: MapDocument,
  svg: SVGSVGElement | null,
): { x: number; y: number } {
  const rect = svg?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x: finitePointerCoordinate(event.clientX), y: finitePointerCoordinate(event.clientY) };
  }
  return {
    x: ((finitePointerCoordinate(event.clientX) - rect.left) / rect.width) * document.width,
    y: ((finitePointerCoordinate(event.clientY) - rect.top) / rect.height) * document.height,
  };
}

function finitePointerCoordinate(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function keyDelta(key: string): { x: number; y: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { x: -1, y: 0 };
    case "ArrowRight":
      return { x: 1, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -1 };
    case "ArrowDown":
      return { x: 0, y: 1 };
    default:
      return null;
  }
}

function sameTransform(left: MapElementTransform, right: MapElementTransform): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.scaleX === right.scaleX &&
    left.scaleY === right.scaleY &&
    left.rotation === right.rotation
  );
}

function isVisible(element: MapElement, layer?: MapLayer): boolean {
  return Boolean(layer?.visible && layer.opacity > 0 && !element.hidden);
}

function layerOrder(layer?: MapLayer): number {
  return layer?.zIndex ?? 0;
}
