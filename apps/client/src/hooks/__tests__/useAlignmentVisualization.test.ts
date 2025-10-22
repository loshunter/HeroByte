import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AlignmentPoint, AlignmentSuggestion } from "../../types/alignment";
import type { KonvaEventObject } from "konva/lib/Node";
import type { SceneObject } from "@shared";
import { useAlignmentVisualization } from "../useAlignmentVisualization";

const mapObject: SceneObject & { type: "map" } = {
  id: "map:1",
  type: "map",
  zIndex: 0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  data: {},
};

const toWorld = (x: number, y: number) => ({ x, y });

describe("useAlignmentVisualization", () => {
  it("returns appropriate instruction text for point counts", () => {
    const points: AlignmentPoint[] = [];
    const { result, rerender } = renderHook(
      ({ alignmentPoints }) =>
        useAlignmentVisualization({
          alignmentMode: true,
          alignmentPoints,
          alignmentSuggestion: null,
          mapObject,
          toWorld,
        }),
      { initialProps: { alignmentPoints: points } },
    );

    expect(result.current.instruction).toContain("Click the first corner");

    const onePoint: AlignmentPoint[] = [{ world: { x: 1, y: 1 }, local: { x: 0, y: 0 } }];
    rerender({ alignmentPoints: onePoint });
    expect(result.current.instruction).toContain("Click the opposite corner");

    const twoPoints: AlignmentPoint[] = [
      { world: { x: 1, y: 1 }, local: { x: 0, y: 0 } },
      { world: { x: 2, y: 2 }, local: { x: 1, y: 1 } },
    ];
    rerender({ alignmentPoints: twoPoints });
    expect(result.current.instruction).toContain("Review the preview");
  });

  it("invokes callback with world and local coordinates on alignment click", () => {
    const handleAlignmentPointCapture = vi.fn();
    const { result } = renderHook(() =>
      useAlignmentVisualization({
        alignmentMode: true,
        alignmentPoints: [],
        alignmentSuggestion: null,
        mapObject,
        toWorld,
        onAlignmentPointCapture: handleAlignmentPointCapture,
      }),
    );

    const stage = {
      pointer: { x: 4, y: 5 },
      getPointerPosition() {
        return this.pointer;
      },
      getStage() {
        return this;
      },
    };

    const event = {
      target: stage,
      evt: {} as PointerEvent,
    } as KonvaEventObject<PointerEvent>;

    result.current.handleAlignmentClick(event);

    expect(handleAlignmentPointCapture).toHaveBeenCalledWith({
      world: { x: 4, y: 5 },
      local: { x: 4, y: 5 },
    });
  });

  it("provides preview line and suggestion line points", () => {
    const alignmentPoints: AlignmentPoint[] = [
      { world: { x: 0, y: 0 }, local: { x: 0, y: 0 } },
      { world: { x: 10, y: 10 }, local: { x: 10, y: 10 } },
    ];
    const alignmentSuggestion: AlignmentSuggestion = {
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      targetA: { x: 0, y: 0 },
      targetB: { x: 15, y: 15 },
      scale: 1,
      rotation: 0,
      error: 0,
    };

    const { result } = renderHook(() =>
      useAlignmentVisualization({
        alignmentMode: true,
        alignmentPoints,
        alignmentSuggestion,
        mapObject,
        toWorld,
      }),
    );

    expect(result.current.previewLine).toEqual([0, 0, 10, 10]);
    expect(result.current.suggestionLine).toEqual([0, 0, 15, 15]);
  });

  it("disables overlay when alignment mode is inactive", () => {
    const { result } = renderHook(() =>
      useAlignmentVisualization({
        alignmentMode: false,
        alignmentPoints: [],
        alignmentSuggestion: null,
        mapObject,
        toWorld,
      }),
    );

    expect(result.current.instruction).toBeNull();
    expect(result.current.previewPoints).toEqual([]);
  });
});
