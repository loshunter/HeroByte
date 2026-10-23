// ============================================================================
// FRAME SHAPE PATHS ON THE MAP — a polygon frame's clip, hit area and outline (C5b)
// ============================================================================
// A circle frame is a corner radius and Konva circles (TokenSprite,
// TokenFrameOverlay). A polygon frame is drawn from the shared outline
// (packages/shared/src/frames/engine/shapes.ts) instead, in three places that
// must agree: the picture clipped to the shape fitted to the token box, the
// hit area on the frame's outer edge, and the outline the selection draws.
// All three follow the frame's pose (framePose): upright unless the token is
// stretched, never mirrored, so the light stays where it is.

import type Konva from "konva";
import { shapeOutline, type PolygonShape } from "@herobyte/shared";
import { framePose } from "./TokenFrameOverlay";

/** The outline at `level` (0.5: the token box) for a token `size` map pixels across, centred on 0. */
export function outlinePoints(shape: PolygonShape, level: number, size: number): number[] {
  return shapeOutline(shape, level).map((value) => value * size);
}

type Pathing = Pick<CanvasRenderingContext2D, "beginPath" | "moveTo" | "lineTo" | "closePath">;

function trace(
  context: Pathing,
  points: readonly number[],
  at: (x: number, y: number) => [number, number],
) {
  context.beginPath();
  for (let index = 0; index < points.length; index += 2) {
    const [x, y] = at(points[index]!, points[index + 1]!);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

const RADIANS = Math.PI / 180;

/** Where a point of the frame (in the frame's own pose, from the token's centre) sits around the node. */
function posed(node: Konva.Node) {
  const pose = framePose(node.scaleX(), node.scaleY(), node.rotation());
  const cos = Math.cos(pose.rotation * RADIANS);
  const sin = Math.sin(pose.rotation * RADIANS);
  return (x: number, y: number): [number, number] => {
    const sx = x * pose.scaleX;
    const sy = y * pose.scaleY;
    return [sx * cos - sy * sin, sx * sin + sy * cos];
  };
}

/**
 * The picture's clip, drawn by the Group holding the token's node: the shape
 * fitted to the token box, where the node is now (mid-drag included).
 */
export function clipToShape(
  context: Pathing,
  node: Konva.Node | null,
  shape: PolygonShape,
  size: number,
): void {
  if (!node || typeof node.x !== "function") return;
  const frame = posed(node);
  const cx = node.x();
  const cy = node.y();
  trace(context, outlinePoints(shape, 0.5, size), (x, y) => {
    const [px, py] = frame(x, y);
    return [cx + px, cy + py];
  });
}

/**
 * The token node's hit area: the frame's outer edge, in the node's own
 * coordinates (its offset, turn and scale undone), so a click on a grown-out
 * frame's corner takes the token and a click in the box outside the shape
 * does not.
 */
export function hitShape(
  context: Konva.Context,
  node: Konva.Shape,
  shape: PolygonShape,
  size: number,
  outer: number,
): void {
  const frame = posed(node);
  const turn = -node.rotation() * RADIANS;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const sx = node.scaleX() || 1;
  const sy = node.scaleY() || 1;
  const ox = node.offsetX();
  const oy = node.offsetY();
  trace(context, outlinePoints(shape, outer, size), (x, y) => {
    const [px, py] = frame(x, y);
    return [ox + (px * cos - py * sin) / sx, oy + (px * sin + py * cos) / sy];
  });
  context.fillStrokeShape(node);
}
