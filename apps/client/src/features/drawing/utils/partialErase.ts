import type { Drawing, SceneObject } from "@shared";
import { splitFreehandDrawing } from "./splitFreehandDrawing";

type DrawingSceneObject = SceneObject & { type: "drawing" };

type Point = { x: number; y: number };

interface PartialEraseNone {
  kind: "none";
}

interface PartialEraseDelete {
  kind: "delete";
}

interface PartialErasePartial {
  kind: "partial";
  segments: Omit<Drawing, "id">[];
}

export type PartialEraseResult = PartialEraseNone | PartialEraseDelete | PartialErasePartial;

function transformPoint(point: Point, drawing: DrawingSceneObject): Point {
  const { transform } = drawing;
  return {
    x: point.x * transform.scaleX + transform.x,
    y: point.y * transform.scaleY + transform.y,
  };
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
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

function freehandSegmentsEqualOriginal(
  originalPoints: Point[],
  segments: Omit<Drawing, "id">[],
): boolean {
  if (segments.length !== 1) {
    return false;
  }

  const [segment] = segments;
  if (!segment) return false;
  if ((segment.points?.length ?? 0) !== originalPoints.length) {
    return false;
  }

  for (let index = 0; index < originalPoints.length; index++) {
    const originalPoint = originalPoints[index]!;
    const nextPoint = segment.points?.[index];
    if (!nextPoint) {
      return false;
    }

    if (originalPoint.x !== nextPoint.x || originalPoint.y !== nextPoint.y) {
      return false;
    }
  }

  return true;
}

function drawingIntersectsEraser(
  drawing: DrawingSceneObject,
  eraserPath: Point[],
  eraserWidth: number,
): boolean {
  const points = drawing.data.drawing.points ?? [];
  if (points.length === 0) {
    return false;
  }

  const drawingType = drawing.data.drawing.type;
  const drawingWidth = drawing.data.drawing.width ?? 0;
  const hitRadius = (eraserWidth + drawingWidth) / 2;

  for (const eraserPoint of eraserPath) {
    switch (drawingType) {
      case "freehand": {
        for (let i = 0; i < points.length - 1; i++) {
          const start = transformPoint(points[i]!, drawing);
          const end = transformPoint(points[i + 1]!, drawing);
          const distance = pointToSegmentDistance(
            eraserPoint.x,
            eraserPoint.y,
            start.x,
            start.y,
            end.x,
            end.y,
          );
          if (distance < hitRadius) {
            return true;
          }
        }
        break;
      }

      case "line": {
        if (points.length < 2) {
          continue;
        }

        const start = transformPoint(points[0]!, drawing);
        const end = transformPoint(points[points.length - 1]!, drawing);
        const distance = pointToSegmentDistance(
          eraserPoint.x,
          eraserPoint.y,
          start.x,
          start.y,
          end.x,
          end.y,
        );
        if (distance < hitRadius) {
          return true;
        }
        break;
      }

      case "rect": {
        if (points.length < 2) {
          continue;
        }

        const topLeft = transformPoint(points[0]!, drawing);
        const bottomRight = transformPoint(points[points.length - 1]!, drawing);
        const x1 = Math.min(topLeft.x, bottomRight.x);
        const y1 = Math.min(topLeft.y, bottomRight.y);
        const x2 = Math.max(topLeft.x, bottomRight.x);
        const y2 = Math.max(topLeft.y, bottomRight.y);

        const insideBounds =
          eraserPoint.x >= x1 - hitRadius &&
          eraserPoint.x <= x2 + hitRadius &&
          eraserPoint.y >= y1 - hitRadius &&
          eraserPoint.y <= y2 + hitRadius;

        if (insideBounds) {
          return true;
        }
        break;
      }

      case "circle": {
        if (points.length < 2) {
          continue;
        }

        const center = transformPoint(points[0]!, drawing);
        const edge = transformPoint(points[points.length - 1]!, drawing);
        const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
        const distanceToCenter = Math.sqrt(
          Math.pow(eraserPoint.x - center.x, 2) + Math.pow(eraserPoint.y - center.y, 2),
        );

        if (Math.abs(distanceToCenter - radius) < hitRadius) {
          return true;
        }
        break;
      }

      case "eraser": {
        break;
      }
    }
  }

  return false;
}

export function evaluatePartialErase(
  drawing: DrawingSceneObject,
  eraserPath: Point[],
  eraserWidth: number,
): PartialEraseResult {
  if (eraserPath.length === 0) {
    return { kind: "none" };
  }

  const drawingType = drawing.data.drawing.type;

  if (drawingType === "freehand") {
    const originalPoints = drawing.data.drawing.points ?? [];
    const segments = splitFreehandDrawing(drawing, eraserPath, eraserWidth);

    if (segments.length === 0) {
      return drawingIntersectsEraser(drawing, eraserPath, eraserWidth)
        ? { kind: "delete" }
        : { kind: "none" };
    }

    if (freehandSegmentsEqualOriginal(originalPoints, segments)) {
      return { kind: "none" };
    }

    return { kind: "partial", segments };
  }

  if (drawingIntersectsEraser(drawing, eraserPath, eraserWidth)) {
    return { kind: "delete" };
  }

  return { kind: "none" };
}
