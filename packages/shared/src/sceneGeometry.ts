// Geometry queries against a compiled scene. The server uses these to make
// compiled walls and doors physically real: a token move is a segment from the
// old position to the new one, and any blocking segment it crosses vetoes it.

import {
  getMovementBlockingSegments,
  type BlockingSegment,
  type CompiledScene,
} from "./sceneCompiler.js";

export interface ScenePoint {
  x: number;
  y: number;
}

/** Matches the live map scene-object transform (Konva order: scale, rotate, translate). */
export interface SceneTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/**
 * Find the first blocking segment (wall or shut door) a straight move crosses,
 * or null when the path is clear. `mapTransform` maps the compiled scene's
 * document coordinates into world coordinates when the DM has moved or scaled
 * the published background.
 */
export function findBlockingSegment(
  scene: CompiledScene,
  from: ScenePoint,
  to: ScenePoint,
  mapTransform?: SceneTransform,
): BlockingSegment | null {
  for (const segment of getMovementBlockingSegments(scene)) {
    const a = toWorldPoint(segment.x1, segment.y1, mapTransform);
    const b = toWorldPoint(segment.x2, segment.y2, mapTransform);
    if (segmentsIntersect(from, to, a, b)) {
      return segment;
    }
  }
  return null;
}

/** Segment intersection including endpoint touches and collinear overlap. */
export function segmentsIntersect(
  a1: ScenePoint,
  a2: ScenePoint,
  b1: ScenePoint,
  b2: ScenePoint,
): boolean {
  const d1 = orientation(b1, b2, a1);
  const d2 = orientation(b1, b2, a2);
  const d3 = orientation(a1, a2, b1);
  const d4 = orientation(a1, a2, b2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(b1, b2, a1)) return true;
  if (d2 === 0 && onSegment(b1, b2, a2)) return true;
  if (d3 === 0 && onSegment(a1, a2, b1)) return true;
  if (d4 === 0 && onSegment(a1, a2, b2)) return true;

  return false;
}

function orientation(a: ScenePoint, b: ScenePoint, c: ScenePoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: ScenePoint, b: ScenePoint, p: ScenePoint): boolean {
  return (
    Math.min(a.x, b.x) <= p.x &&
    p.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= p.y &&
    p.y <= Math.max(a.y, b.y)
  );
}

function toWorldPoint(x: number, y: number, transform?: SceneTransform): ScenePoint {
  if (!transform) return { x, y };
  return transformScenePoint(transform, { x, y });
}

/** Scene/document space -> world space (Konva order: scale, rotate, translate). */
export function transformScenePoint(transform: SceneTransform, point: ScenePoint): ScenePoint {
  const scaledX = point.x * transform.scaleX;
  const scaledY = point.y * transform.scaleY;
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: transform.x + scaledX * cos - scaledY * sin,
    y: transform.y + scaledX * sin + scaledY * cos,
  };
}

/**
 * Token grid-cell coordinates -> world pixels (cell center). Mirrors the
 * client renderer's `x * gridSize + gridSize / 2`; every geometry check
 * against tokens must convert through this first.
 */
export function gridCellToWorldPoint(gridSize: number, cell: ScenePoint): ScenePoint {
  return { x: cell.x * gridSize + gridSize / 2, y: cell.y * gridSize + gridSize / 2 };
}

/** World space -> scene/document space. Inverse of transformScenePoint. */
export function inverseTransformScenePoint(
  transform: SceneTransform,
  point: ScenePoint,
): ScenePoint {
  const dx = point.x - transform.x;
  const dy = point.y - transform.y;
  const radians = (-transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotatedX = dx * cos - dy * sin;
  const rotatedY = dx * sin + dy * cos;
  return { x: rotatedX / transform.scaleX, y: rotatedY / transform.scaleY };
}
