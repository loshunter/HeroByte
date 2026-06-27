import type { MapElement, MapLayer } from "@herobyte/shared";

export function MapStudioElementPreview({
  element,
  layer,
}: {
  element: MapElement;
  layer: MapLayer;
}) {
  const { x, y, scaleX, scaleY, rotation } = element.transform;
  const transform = `translate(${x} ${y}) rotate(${rotation}) scale(${scaleX} ${scaleY})`;
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
}

export function MapStudioSelectionOverlay({
  element,
  layer,
}: {
  element: MapElement;
  layer: MapLayer;
}) {
  const bounds = elementBounds(element);
  if (!bounds) return null;
  const { x, y, scaleX, scaleY, rotation } = element.transform;
  const transform = `translate(${x} ${y}) rotate(${rotation}) scale(${scaleX} ${scaleY})`;
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

function elementBounds(element: MapElement) {
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
  if (element.type === "tile") {
    return {
      x: 0,
      y: 0,
      width: element.data.columns * 50,
      height: element.data.rows * 50,
    };
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
