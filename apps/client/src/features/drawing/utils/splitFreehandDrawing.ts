import type { Drawing, SceneObject, SceneObjectTransform } from "@shared";

type DrawingSceneObject = SceneObject & { type: "drawing" };
type Point = { x: number; y: number };

const RAD_PER_DEG = Math.PI / 180;

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

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

function computeBoundingBox(points: Point[]): BoundingBox {
  let minX = points[0]!.x;
  let maxX = points[0]!.x;
  let minY = points[0]!.y;
  let maxY = points[0]!.y;

  for (let index = 1; index < points.length; index++) {
    const { x, y } = points[index]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

function expandBoundingBox(box: BoundingBox, amount: number): BoundingBox {
  return {
    minX: box.minX - amount,
    maxX: box.maxX + amount,
    minY: box.minY - amount,
    maxY: box.maxY + amount,
  };
}

function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function createPointBoundingBox(point: Point): BoundingBox {
  return { minX: point.x, maxX: point.x, minY: point.y, maxY: point.y };
}

function computeSegmentBounds(start: Point, end: Point, expansion: number): BoundingBox {
  const bounds = computeBoundingBox([start, end]);
  return expandBoundingBox(bounds, expansion);
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (value === 0) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y)
  );
}

function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const o1 = orientation(p1, p2, q1);
  const o2 = orientation(p1, p2, q2);
  const o3 = orientation(q1, q2, p1);
  const o4 = orientation(q1, q2, p2);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, p2, q2)) return true;
  if (o3 === 0 && onSegment(q1, q2, p1)) return true;
  if (o4 === 0 && onSegment(q1, q2, p2)) return true;

  return false;
}

function segmentDistance(
  p1: Point,
  p2: Point,
  q1: Point,
  q2: Point,
  pointDistance: (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => number,
): number {
  if (segmentsIntersect(p1, p2, q1, q2)) {
    return 0;
  }

  const distances = [
    pointDistance(p1.x, p1.y, q1.x, q1.y, q2.x, q2.y),
    pointDistance(p2.x, p2.y, q1.x, q1.y, q2.x, q2.y),
    pointDistance(q1.x, q1.y, p1.x, p1.y, p2.x, p2.y),
    pointDistance(q2.x, q2.y, p1.x, p1.y, p2.x, p2.y),
  ];

  return Math.min(...distances);
}

interface SegmentCandidate {
  start: Point;
  end: Point;
  bounds: BoundingBox;
}

function buildSegments(
  points: Point[],
  expansion: number,
  fallbackRadius: number,
): SegmentCandidate[] {
  if (points.length === 0) {
    return [];
  }

  if (points.length === 1) {
    return [
      {
        start: points[0]!,
        end: points[0]!,
        bounds: expandBoundingBox(createPointBoundingBox(points[0]!), fallbackRadius),
      },
    ];
  }

  const segments: SegmentCandidate[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]!;
    const end = points[index + 1]!;
    segments.push({
      start,
      end,
      bounds: computeSegmentBounds(start, end, expansion),
    });
  }
  return segments;
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

  const drawingBounds = expandBoundingBox(computeBoundingBox(worldPoints), hitRadius);
  const eraserBounds = expandBoundingBox(computeBoundingBox(eraserPath), eraserWidth / 2);

  if (!boxesIntersect(drawingBounds, eraserBounds)) {
    return [buildSegmentFromPoints(template, points)];
  }

  const eraserSegments = buildSegments(eraserPath, hitRadius, eraserWidth / 2);
  const drawingSegments = buildSegments(worldPoints, hitRadius, hitRadius);
  const shouldEraseSegment: boolean[] = new Array(drawingSegments.length).fill(false);

  for (let segmentIndex = 0; segmentIndex < drawingSegments.length; segmentIndex++) {
    const segment = drawingSegments[segmentIndex]!;

    for (const eraserSegment of eraserSegments) {
      if (!boxesIntersect(segment.bounds, eraserSegment.bounds)) {
        continue;
      }

      const distance = segmentDistance(
        segment.start,
        segment.end,
        eraserSegment.start,
        eraserSegment.end,
        pointToSegmentDistance,
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
