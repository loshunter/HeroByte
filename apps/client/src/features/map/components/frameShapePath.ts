// ============================================================================
// FRAME SHAPE PATHS ON THE MAP — a polygon frame's clip, hit area and outline (C5b)
// ============================================================================
// A circle frame is a corner radius and Konva circles (TokenSprite,
// TokenFrameOverlay). A polygon frame is drawn from the shared outline
// (packages/shared/src/frames/engine/shapes.ts) instead, in three places that
// must agree: the picture drawn in the shape fitted to the token box, the
// hit area on the frame's outer edge, and the outline the selection draws.
// All three follow the frame's pose (framePose): upright unless the token is
// stretched, never mirrored, so the light stays where it is.

import type Konva from "konva";
import { shapeOutline, type PolygonShape } from "@herobyte/shared";

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

// Here, not in TokenFrameOverlay: this module must load without react-konva
// (Node 18 cannot require() konva's ES module, so its tests fail to load).
/** The overlay's scale and turn for a token's: unflipped, and upright unless stretched. */
export function framePose(scaleX: number, scaleY: number, rotation: number) {
  const x = Math.abs(scaleX);
  const y = Math.abs(scaleY);
  const stretched = Math.abs(x - y) > 1e-3 * Math.max(x, y, 1);
  return { scaleX: x, scaleY: y, rotation: stretched ? rotation : 0 };
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
 * The outline at `level` traced in the token node's own coordinates: its
 * offset, turn and scale undone, so the path sits where the upright frame is.
 */
function traceLocal(
  context: Pathing,
  node: Konva.Shape,
  shape: PolygonShape,
  size: number,
  level: number,
): void {
  const frame = posed(node);
  const turn = -node.rotation() * RADIANS;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const sx = node.scaleX() || 1;
  const sy = node.scaleY() || 1;
  const ox = node.offsetX();
  const oy = node.offsetY();
  trace(context, outlinePoints(shape, level, size), (x, y) => {
    const [px, py] = frame(x, y);
    return [ox + (px * cos - py * sin) / sx, oy + (px * sin + py * cos) / sy];
  });
}

/**
 * The token node's own drawing: its picture, or its colour, inside the shape
 * fitted to the token box. Drawn by the node itself, not clipped by a group
 * round it: a group's clip clips the hit canvas too, and the hit area must
 * reach a grown-out frame's edge.
 */
export function drawInShape(
  context: Konva.Context,
  node: Konva.Shape,
  shape: PolygonShape,
  size: number,
  image?: CanvasImageSource,
  color?: string,
): void {
  if (!image) {
    traceLocal(context, node, shape, size, 0.5);
    context.fillStrokeShape(node);
    return;
  }
  context.save();
  traceLocal(context, node, shape, size, 0.5);
  context.clip();
  // The window stays upright while the picture turns with the token: its
  // colour fills only the corners a turned picture leaves open (the window
  // less the picture's square, a pixel in so the picture's edge covers the
  // colour's), so a transparent picture shows the map through it, as a circle
  // frame's does. Unturned, or turned with a stretched frame, there are none.
  const pose = framePose(node.scaleX(), node.scaleY(), node.rotation());
  if (color && pose.rotation === 0 && node.rotation() % 90 !== 0) {
    const ratio =
      (context as { canvas?: { getPixelRatio?: () => number } }).canvas?.getPixelRatio?.() ?? 1;
    const inset = 1 / (Math.abs(node.getAbsoluteScale?.().x ?? 1) * ratio || 1);
    traceLocal(context, node, shape, size, 0.5);
    context.rect(inset, inset, node.width() - 2 * inset, node.height() - 2 * inset);
    context.fillStyle = color;
    context.fill("evenodd");
  }
  context.drawImage(image, 0, 0, node.width(), node.height());
  context.restore();
}

/**
 * The token node's hit area: the frame's outer edge, so a click on a grown-out
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
  traceLocal(context, node, shape, size, outer);
  context.fillStrokeShape(node);
}
