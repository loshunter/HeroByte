import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument, MapElement } from "@herobyte/shared";
import { useMapEditSelection } from "../useMapEditSelection";

const tile: MapElement = {
  id: "tile1",
  layerId: "objects",
  type: "tile",
  locked: false,
  hidden: false,
  transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { assetId: "objects:crate", columns: 1, rows: 1 },
};

function makeDocument(): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Live",
    width: 8192,
    height: 8192,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: [
      {
        id: "objects",
        name: "Objects",
        kind: "objects",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 20,
      },
    ],
    elements: [tile],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("useMapEditSelection", () => {
  it("select tool click reports the element under the cursor", () => {
    const onSelectElement = vi.fn();
    const { result } = renderHook(() =>
      useMapEditSelection({
        active: true,
        document: makeDocument(),
        selectedElementId: null,
        onSelectElement,
        onSampleAsset: vi.fn(),
      }),
    );
    let consumed = false;
    act(() => {
      consumed = result.current.handleClick({ x: 120, y: 120 }, "select");
    });
    expect(consumed).toBe(true);
    expect(onSelectElement).toHaveBeenCalledWith("tile1");
  });

  it("Ctrl+click on the place tool samples the asset and consumes the click", () => {
    const onSampleAsset = vi.fn();
    const { result } = renderHook(() =>
      useMapEditSelection({
        active: true,
        document: makeDocument(),
        selectedElementId: null,
        onSelectElement: vi.fn(),
        onSampleAsset,
      }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
    });
    let consumed = false;
    act(() => {
      consumed = result.current.handleClick({ x: 120, y: 120 }, "place");
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" }));
    });
    expect(consumed).toBe(true);
    expect(onSampleAsset).toHaveBeenCalledWith("objects:crate");
  });

  it("does not consume a normal place click (no Ctrl, not select)", () => {
    const { result } = renderHook(() =>
      useMapEditSelection({
        active: true,
        document: makeDocument(),
        selectedElementId: null,
        onSelectElement: vi.fn(),
        onSampleAsset: vi.fn(),
      }),
    );
    let consumed = true;
    act(() => {
      consumed = result.current.handleClick({ x: 120, y: 120 }, "place");
    });
    expect(consumed).toBe(false);
  });

  it("exposes the selection highlight rect for the selected element", () => {
    const { result } = renderHook(() =>
      useMapEditSelection({
        active: true,
        document: makeDocument(),
        selectedElementId: "tile1",
        onSelectElement: vi.fn(),
        onSampleAsset: vi.fn(),
      }),
    );
    expect(result.current.selectionRect).toEqual({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      rotation: 0,
      pivotX: 25,
      pivotY: 25,
    });
  });
});
