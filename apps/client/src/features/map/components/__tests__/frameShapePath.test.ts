// A polygon frame on the map (C5b): the hit area is the frame's outer edge in
// the token node's own coordinates, upright with the frame however the token
// is turned; the picture's clip is the shape fitted to the token box, wherever
// the node is now.

import { describe, expect, it } from "vitest";
import type Konva from "konva";
import { insideOutline, presetFrame, layoutFrame } from "@herobyte/shared";
import { drawInShape, hitShape } from "../frameShapePath";

const SIZE = 60;

/** A canvas context that only records the path it is given. */
function recorder() {
  const points: number[] = [];
  const calls: string[] = [];
  return {
    points,
    calls,
    context: {
      beginPath: () => points.splice(0),
      moveTo: (x: number, y: number) => points.push(x, y),
      lineTo: (x: number, y: number) => points.push(x, y),
      closePath: () => {},
      fillStrokeShape: () => calls.push("fill"),
      fill: () => calls.push("fillPath"),
      fillStyle: "",
      save: () => calls.push("save"),
      clip: () => calls.push("clip"),
      drawImage: () => calls.push("drawImage"),
      restore: () => calls.push("restore"),
    },
  };
}
/** A token node at (100, 80): its box 60 px, offset to its centre, turned and scaled. */
function node(rotation = 0, scaleX = 1, scaleY = 1) {
  return {
    x: () => 100,
    y: () => 80,
    rotation: () => rotation,
    scaleX: () => scaleX,
    scaleY: () => scaleY,
    offsetX: () => SIZE / 2,
    offsetY: () => SIZE / 2,
    width: () => SIZE,
    height: () => SIZE,
  } as unknown as Konva.Shape;
}
/** A point given from the token's centre on the map, in the node's own coordinates. */
function local(n: ReturnType<typeof node>, dx: number, dy: number) {
  const turn = (-n.rotation() * Math.PI) / 180;
  const x = dx * Math.cos(turn) - dy * Math.sin(turn);
  const y = dx * Math.sin(turn) + dy * Math.cos(turn);
  return [n.offsetX() + x / n.scaleX(), n.offsetY() + y / n.scaleY()] as const;
}

describe("a polygon frame's hit area", () => {
  const out = {
    ...presetFrame("stone.castle", 0.24)!,
    shape: "hexagon" as const,
    growth: "out" as const,
  };
  const outer = layoutFrame(out).outer;

  it("takes a click on a grown-out frame's corner, and none in the box outside the shape", () => {
    const n = node();
    const { points, context } = recorder();
    hitShape(context as unknown as Konva.Context, n, "hexagon", SIZE, outer);
    // the right corner of the grown-out hexagon, past the token box
    expect(insideOutline(points, ...local(n, 0.6 * SIZE, 0))).toBe(true);
    // the box's top-right corner: inside the token box, outside the hexagon
    expect(insideOutline(points, ...local(n, 0.49 * SIZE, -0.49 * SIZE))).toBe(false);
  });

  it("stays upright with the frame when the token is turned", () => {
    const n = node(30);
    const { points, context } = recorder();
    hitShape(context as unknown as Konva.Context, n, "hexagon", SIZE, outer);
    // the frame does not turn, so its right corner is still to the right on the map
    expect(insideOutline(points, ...local(n, 0.6 * SIZE, 0))).toBe(true);
    expect(insideOutline(points, ...local(n, 0, -0.6 * SIZE))).toBe(false);
  });

  it("is never mirrored: a flipped shield's point stays at the bottom", () => {
    const n = node(0, 1, -1);
    const { points, context } = recorder();
    hitShape(context as unknown as Konva.Context, n, "shield", SIZE, 0.5);
    expect(insideOutline(points, ...local(n, 0.3 * SIZE, -0.45 * SIZE))).toBe(true); // the top corner
    expect(insideOutline(points, ...local(n, 0.3 * SIZE, 0.45 * SIZE))).toBe(false); // beside the point
  });

  it("follows a stretched token, as the frame does", () => {
    const n = node(0, 2, 1);
    const { points, context } = recorder();
    hitShape(context as unknown as Konva.Context, n, "square", SIZE, 0.5);
    expect(insideOutline(points, ...local(n, 0.95 * SIZE, 0))).toBe(true); // twice as wide
    expect(insideOutline(points, ...local(n, 0, 0.6 * SIZE))).toBe(false);
  });
});

describe("a polygon frame's picture", () => {
  it("is drawn by its own node inside the shape fitted to the token box", () => {
    const { points, calls, context } = recorder();
    drawInShape(
      context as unknown as Konva.Context,
      node(),
      "square",
      SIZE,
      {} as CanvasImageSource,
    );
    expect(calls).toEqual(["save", "clip", "drawImage", "restore"]);
    const xs = points.filter((_, index) => index % 2 === 0);
    const ys = points.filter((_, index) => index % 2 === 1);
    // node-local: the box from 0 to 60 (its offset is its centre)
    expect(Math.min(...xs)).toBeCloseTo(0);
    expect(Math.max(...xs)).toBeCloseTo(60);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(60);
  });

  it("fills its window with the token's colour under a turned picture", () => {
    const { calls, context } = recorder();
    drawInShape(
      context as unknown as Konva.Context,
      node(45),
      "square",
      SIZE,
      {} as CanvasImageSource,
      "#ff0000",
    );
    expect(calls).toEqual(["save", "fillPath", "clip", "drawImage", "restore"]);
  });

  it("is its colour filling the shape when it has no picture", () => {
    const { calls, context } = recorder();
    drawInShape(context as unknown as Konva.Context, node(), "hexagon", SIZE);
    expect(calls).toEqual(["fill"]);
  });
});
