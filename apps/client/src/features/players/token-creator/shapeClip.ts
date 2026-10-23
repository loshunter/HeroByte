// ============================================================================
// TOKEN CREATOR — A FRAME'S SHAPE IN THE CREATOR (C5b)
// ============================================================================
// The picture is always baked as a full square (C4), so the shape is only a
// window onto it: the crop square, the Picture tab's previews and the Frame
// tab's previews show the frame's shape as the map will clip it, fitted to the
// token box (level 0.5 of the shared outline).

import { isPolygonShape, shapeOutline, type FrameShape } from "@herobyte/shared";

/** A CSS `clip-path` for the shape over a square element, or undefined for a circle or no frame. */
export function shapeClipPath(shape: FrameShape | undefined): string | undefined {
  if (!isPolygonShape(shape)) return undefined;
  const points = shapeOutline(shape, 0.5);
  const corners: string[] = [];
  for (let index = 0; index < points.length; index += 2) {
    const x = ((points[index]! + 0.5) * 100).toFixed(2);
    const y = ((points[index + 1]! + 0.5) * 100).toFixed(2);
    corners.push(`${x}% ${y}%`);
  }
  return `polygon(${corners.join(", ")})`;
}

/** The shape as SVG polygon points over a 100 by 100 box, or undefined for a circle or no frame. */
export function shapePolygonPoints(shape: FrameShape | undefined): string | undefined {
  if (!isPolygonShape(shape)) return undefined;
  const points = shapeOutline(shape, 0.5);
  const pairs: string[] = [];
  for (let index = 0; index < points.length; index += 2) {
    pairs.push(
      `${((points[index]! + 0.5) * 100).toFixed(2)},${((points[index + 1]! + 0.5) * 100).toFixed(2)}`,
    );
  }
  return pairs.join(" ");
}

type Pathing = Pick<CanvasRenderingContext2D, "moveTo" | "lineTo" | "closePath">;

/** The shape's path on a canvas, `token` pixels across, centred on (centre, centre). */
export function traceShape(
  context: Pathing,
  shape: FrameShape,
  centre: number,
  token: number,
): void {
  if (!isPolygonShape(shape)) return;
  const points = shapeOutline(shape, 0.5);
  for (let index = 0; index < points.length; index += 2) {
    const x = centre + points[index]! * token;
    const y = centre + points[index + 1]! * token;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}
