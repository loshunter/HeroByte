import type { Drawing, SceneObject, SceneObjectTransform } from "@shared";

type DrawingSceneObject = SceneObject & { type: "drawing" };
type Point = { x: number; y: number };

const RAD_PER_DEG = Math.PI / 180;

function applyTransform(point: Point, transform: SceneObjectTransform): Point {
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const rotation = (transform.rotation ?? 0) * RAD_PER_DEG;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  const scaledX = point.x * scaleX;
  const scaledY = point.y * scaleY;

  const rotatedX = scaledX * cos - scaledY * sin;
  const rotatedY = scaledX * sin + scaledY * cos;

  return {
    x: rotatedX + (transform.x ?? 0),
    y: rotatedY + (transform.y ?? 0),
  };
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function toWorldPoints(points: Point[], transform: SceneObjectTransform): Point[] {
  return points.map((point) => applyTransform(point, transform));
}

function computeStrokeWidthInWorld(width: number, transform: SceneObjectTransform): number {
  const scaleX = Math.abs(transform.scaleX ?? 1);
  const scaleY = Math.abs(transform.scaleY ?? 1);
  if (scaleX === scaleY) {
    return width * scaleX;
  }
  // Approximate mixed scaling by averaging axes - adequate until spatial
  // optimizations (Phase 11) introduce more precise handling.
  return width * ((scaleX + scaleY) / 2);
}

function createSegmentTemplate(drawing: Drawing): Omit<Drawing, "id"> {
  const { id: _omitId, selectedBy: _omitSelection, ...rest } = drawing;
  return rest;
}

function buildSegmentFromPoints(
  template: Omit<Drawing, "id">,
  points: Point[],
): Omit<Drawing, "id"> {
  const clonedPoints = clonePoints(points);
  return {
    ...template,
    type: "freehand",
    points: clonedPoints,
  };
}

export function splitFreehandDrawing(
  drawingObject: DrawingSceneObject,
  eraserPath: Point[],
  eraserWidth: number,
): Omit<Drawing, "id">[] {
  const drawing = drawingObject.data.drawing;

  const points = drawing.points ?? [];
  if (points.length < 2) {
    return [];
  }

  const template = createSegmentTemplate(drawing);

  if (drawing.type !== "freehand") {
    return [buildSegmentFromPoints(template, points)];
  }

  if (eraserPath.length === 0) {
    return [buildSegmentFromPoints(template, points)];
  }

  const transform: SceneObjectTransform = {
    x: drawingObject.transform?.x ?? 0,
    y: drawingObject.transform?.y ?? 0,
    scaleX: drawingObject.transform?.scaleX ?? 1,
    scaleY: drawingObject.transform?.scaleY ?? 1,
    rotation: drawingObject.transform?.rotation ?? 0,
  };

  const worldPoints = toWorldPoints(points, transform);
  const drawingStrokeWidth = computeStrokeWidthInWorld(drawing.width, transform);
  const hitRadius = (drawingStrokeWidth + eraserWidth) / 2;

  const shouldEraseSegment: boolean[] = new Array(points.length - 1).fill(false);

  for (let segmentIndex = 0; segmentIndex < worldPoints.length - 1; segmentIndex++) {
    const start = worldPoints[segmentIndex];
    const end = worldPoints[segmentIndex + 1];

    for (const eraserPoint of eraserPath) {
      const distance = pointToSegmentDistance(
        eraserPoint.x,
        eraserPoint.y,
        start.x,
        start.y,
        end.x,
        end.y,
      );
      if (distance < hitRadius) {
        shouldEraseSegment[segmentIndex] = true;
        break;
      }
    }
  }

  const anyErased = shouldEraseSegment.some(Boolean);
  const segments: Omit<Drawing, "id">[] = [];

  let currentSegment: Point[] = [points[0]!];

  for (let i = 0; i < points.length - 1; i++) {
    if (!shouldEraseSegment[i]) {
      currentSegment.push(points[i + 1]!);
      continue;
    }

    if (currentSegment.length >= 2) {
      segments.push(buildSegmentFromPoints(template, currentSegment));
    }

    currentSegment = [points[i + 1]!];
  }

  if (currentSegment.length >= 2) {
    segments.push(buildSegmentFromPoints(template, currentSegment));
  }

  if (!anyErased) {
    return [buildSegmentFromPoints(template, points)];
  }

  return segments.filter((segment) => segment.points.length >= 2);
}
