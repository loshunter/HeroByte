import { memo } from "react";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../starterTiles";
import {
  isAutotileCandidate,
  tileBoundaryPath,
  type AutotileGrid,
  type TileOccupancy,
} from "../tileAutotiling";

// Memoized: the studio canvas re-renders on every pointermove (cursor ghost
// state), and element/layer/autotile references only change on real edits.
export const MapStudioElementPreview = memo(function MapStudioElementPreview({
  element,
  layer,
  gridSize = 50,
  autotile,
}: {
  element: MapElement;
  layer: MapLayer;
  gridSize?: number;
  /** Occupancy and its grid travel together so binning can't disagree. */
  autotile?: { occupancy: TileOccupancy; grid: AutotileGrid };
}) {
  const { x, y, scaleX, scaleY, rotation } = element.transform;
  const transform = `translate(${x} ${y}) rotate(${rotation}) scale(${scaleX} ${scaleY})`;
  if (element.type === "tile" || element.type === "stamp") {
    const asset = getMapStudioTileAsset(element.data.assetId);
    const width = element.type === "tile" ? element.data.columns * gridSize : element.data.width;
    const height = element.type === "tile" ? element.data.rows * gridSize : element.data.height;
    const tint = element.data.tint;
    // Footprint elements spin around their visual center, not the corner.
    const footprintTransform = `translate(${x} ${y}) rotate(${rotation} ${(width * scaleX) / 2} ${(height * scaleY) / 2}) scale(${scaleX} ${scaleY})`;
    // Image-backed (uploaded) assets render the picture itself — checked
    // before autotiling so an on-grid upload never fuses like terrain.
    if (asset.imageUrl) {
      return (
        <g transform={footprintTransform} opacity={layer.opacity}>
          <image
            href={asset.imageUrl}
            width={width}
            height={height}
            preserveAspectRatio="none"
            style={{ imageRendering: "pixelated" }}
          />
          {tint && <rect width={width} height={height} fill={tint} opacity={0.35} />}
        </g>
      );
    }
    if (element.type === "tile" && autotile && isAutotileCandidate(element, autotile.grid)) {
      // Autotiled terrain: no per-tile outline; borders appear only where a
      // cell faces different terrain, so contiguous paint reads as one surface.
      const boundary = tileBoundaryPath(element, autotile.grid, autotile.occupancy);
      return (
        <g transform={footprintTransform} opacity={layer.opacity}>
          <rect width={width} height={height} fill={tint ?? asset.fill} />
          {boundary && (
            <path
              d={boundary}
              fill="none"
              stroke={asset.stroke}
              strokeWidth={Math.max(2, gridSize * 0.04)}
            />
          )}
        </g>
      );
    }
    return (
      <g transform={footprintTransform} opacity={layer.opacity}>
        <rect
          width={width}
          height={height}
          fill={tint ?? asset.fill}
          stroke={asset.stroke}
          strokeWidth={Math.max(2, gridSize * 0.04)}
        />
        {asset.accent && (
          <>
            <path
              d={`M 0 ${height / 2} H ${width} M ${width / 2} 0 V ${height}`}
              stroke={asset.accent}
              strokeWidth={Math.max(1, gridSize * 0.025)}
              opacity={0.65}
            />
            <path
              d={`M ${Math.max(4, gridSize * 0.16)} ${Math.max(4, gridSize * 0.16)} L ${Math.max(8, width - gridSize * 0.16)} ${Math.max(4, gridSize * 0.16)}`}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={Math.max(1, gridSize * 0.02)}
            />
          </>
        )}
      </g>
    );
  }
  if (element.type === "shape") {
    const [start, end] = element.data.points;
    if (!start || !end) return null;
    const bounds = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
    const common = {
      fill: element.data.fill ?? "none",
      stroke: element.data.stroke,
      strokeWidth: element.data.strokeWidth,
      opacity: element.data.opacity * layer.opacity,
      transform,
    };
    return element.data.shape === "ellipse" ? (
      <ellipse
        cx={bounds.x + bounds.width / 2}
        cy={bounds.y + bounds.height / 2}
        rx={bounds.width / 2}
        ry={bounds.height / 2}
        {...common}
      />
    ) : (
      <rect {...bounds} {...common} />
    );
  }
  if (element.type === "text") {
    return (
      <text transform={transform} fill={element.data.color} fontSize={element.data.fontSize}>
        {element.data.text}
      </text>
    );
  }
  if (element.type === "light") {
    return (
      <circle
        transform={transform}
        r={element.data.radius}
        fill={element.data.color}
        opacity={element.data.intensity * layer.opacity * 0.5}
      />
    );
  }
  if (element.type === "wall") {
    const points = element.data.points.map((point) => `${point.x},${point.y}`).join(" ");
    return (
      <polyline
        transform={transform}
        points={points}
        fill="none"
        stroke="#e9d8a6"
        strokeWidth={6}
        opacity={layer.opacity}
      />
    );
  }
  if (element.type === "door") {
    return (
      <line
        transform={transform}
        x1={0}
        y1={0}
        x2={element.data.width}
        y2={0}
        stroke={doorStroke(element.data.state)}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={element.data.state === "open" ? "10 8" : undefined}
        opacity={layer.opacity}
      />
    );
  }
  return null;
});

export function MapStudioSelectionOverlay({
  element,
  layer,
  gridSize = 50,
}: {
  element: MapElement;
  layer: MapLayer;
  gridSize?: number;
}) {
  const bounds = elementBounds(element, gridSize);
  if (!bounds) return null;
  const { x, y, scaleX, scaleY, rotation } = element.transform;
  const footprint = element.type === "tile" || element.type === "stamp";
  const transform = footprint
    ? `translate(${x} ${y}) rotate(${rotation} ${(bounds.width * scaleX) / 2} ${(bounds.height * scaleY) / 2}) scale(${scaleX} ${scaleY})`
    : `translate(${x} ${y}) rotate(${rotation}) scale(${scaleX} ${scaleY})`;
  return (
    <rect
      {...bounds}
      transform={transform}
      fill="none"
      stroke="#7fd6ff"
      strokeWidth={Math.max(2, 4 / Math.max(layer.opacity, 0.25))}
      strokeDasharray="12 8"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}

function elementBounds(element: MapElement, gridSize: number) {
  if (element.type === "tile") {
    return {
      x: 0,
      y: 0,
      width: element.data.columns * gridSize,
      height: element.data.rows * gridSize,
    };
  }
  if (element.type === "shape") {
    const [start, end] = element.data.points;
    if (!start || !end) return null;
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }
  if (element.type === "door") {
    return { x: 0, y: -12, width: element.data.width, height: 24 };
  }
  if (element.type === "light") {
    return {
      x: -element.data.radius,
      y: -element.data.radius,
      width: element.data.radius * 2,
      height: element.data.radius * 2,
    };
  }
  if (element.type === "wall") {
    const xs = element.data.points.map((point) => point.x);
    const ys = element.data.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      width: Math.max(1, Math.max(...xs) - minX),
      height: Math.max(1, Math.max(...ys) - minY),
    };
  }
  if (element.type === "text") {
    return {
      x: 0,
      y: -element.data.fontSize,
      width: Math.max(
        element.data.fontSize,
        element.data.text.length * element.data.fontSize * 0.6,
      ),
      height: element.data.fontSize * 1.2,
    };
  }
  if (element.type === "stamp") {
    return { x: 0, y: 0, width: element.data.width, height: element.data.height };
  }
  return null;
}

function doorStroke(state: Extract<MapElement, { type: "door" }>["data"]["state"]): string {
  switch (state) {
    case "open":
      return "#7fd68a";
    case "locked":
      return "#e07070";
    case "secret":
      return "#9c89d9";
    case "closed":
      return "#c99b55";
  }
}
