import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SceneObject } from "@herobyte/shared";
import { useObjectTransformHandlers } from "../useObjectTransformHandlers";

/**
 * Regression pin for the gizmo/prop drift bug.
 *
 * PropsLayer renders a prop sprite at `t.x*grid + grid/2 − size/2` (cell
 * centre minus the sprite's own half-size), and its onDragEnd inverts exactly
 * that. The gizmo path used to divide the raw node position by gridSize —
 * shifting every gizmo drag by (0.5 − 0.375·sizeMultiplier) cells while plain
 * drags stayed put: +0.125 cells for a medium prop, +0.3125 for a tiny one.
 *
 * The pin is a round trip: render-transform a grid position to pixels the way
 * PropsLayer does, feed it through handleGizmoTransform, and require the SAME
 * grid position back — per size category, since the sprite size is what the
 * old code ignored.
 */

const GRID = 50;

function propObject(size: "tiny" | "medium"): SceneObject {
  return {
    id: "prop:p1",
    type: "prop",
    owner: "someone",
    zIndex: 7,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { imageUrl: "x.png", label: "Crate", size },
  };
}

/** PropsLayer's render mapping: grid units → the sprite node's pixel x/y. */
function renderedPixel(gridUnits: number, sizeMultiplier: number): number {
  const spriteSize = GRID * 0.75 * sizeMultiplier;
  return gridUnits * GRID + GRID / 2 - spriteSize / 2;
}

function run(size: "tiny" | "medium", pixel: { x: number; y: number }) {
  const onTransformObject = vi.fn();
  const { result } = renderHook(() =>
    useObjectTransformHandlers({
      onTransformObject,
      sceneObjects: [propObject(size)],
      gridSize: GRID,
    }),
  );
  result.current.handleGizmoTransform({ id: "prop:p1", position: pixel });
  return onTransformObject;
}

describe("useObjectTransformHandlers — gizmo prop inverse", () => {
  it("round-trips a medium prop's position exactly (was +0.125 cells per drag)", () => {
    const spy = run("medium", { x: renderedPixel(3, 1.0), y: renderedPixel(2, 1.0) });
    const sent = spy.mock.calls[0][0];
    expect(sent.position.x).toBeCloseTo(3, 10);
    expect(sent.position.y).toBeCloseTo(2, 10);
  });

  it("round-trips a tiny prop's position exactly (was +0.3125 cells per drag)", () => {
    const spy = run("tiny", { x: renderedPixel(3, 0.5), y: renderedPixel(3, 0.5) });
    const sent = spy.mock.calls[0][0];
    expect(sent.position.x).toBeCloseTo(3, 10);
    expect(sent.position.y).toBeCloseTo(3, 10);
  });

  it("still sends scale and rotation through untouched", () => {
    const onTransformObject = vi.fn();
    const { result } = renderHook(() =>
      useObjectTransformHandlers({
        onTransformObject,
        sceneObjects: [propObject("medium")],
        gridSize: GRID,
      }),
    );
    result.current.handleGizmoTransform({
      id: "prop:p1",
      scale: { x: 2, y: 2 },
      rotation: 45,
    });
    expect(onTransformObject).toHaveBeenCalledWith({
      id: "prop:p1",
      position: undefined,
      scale: { x: 2, y: 2 },
      rotation: 45,
    });
  });
});
