import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import { usePopulate } from "../usePopulate";
import type { MapStudioController } from "../../map-studio/types";

function makeDocument(): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Live Map",
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
    elements: [],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeController(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    activeDocument: makeDocument(),
    saving: false,
    addStamps: vi.fn(() => ["s1"]),
    ...overrides,
  } as unknown as MapStudioController;
}

describe("usePopulate", () => {
  it("cannot populate before a region is placed", () => {
    const { result } = renderHook(() => usePopulate(makeController()));
    expect(result.current.canPopulate).toBe(false);
    act(() => result.current.onPopulate());
  });

  it("fills the last-placed region with ONE add-elements command", () => {
    const controller = makeController();
    const { result } = renderHook(() => usePopulate(controller));

    act(() => result.current.onRegionPlaced({ x: 0, y: 0, width: 500, height: 500 }));
    expect(result.current.canPopulate).toBe(true);

    act(() => result.current.onPopulate());
    expect(controller.addStamps).toHaveBeenCalledTimes(1);
    const drafts = (controller.addStamps as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(drafts.length).toBeGreaterThan(0);
    // Objects-category stamps land on the objects layer.
    expect(drafts.every((d: { layerId: string }) => d.layerId === "objects")).toBe(true);
  });

  it("does not populate while the controller is saving", () => {
    const controller = makeController({ saving: true });
    const { result } = renderHook(() => usePopulate(controller));
    act(() => result.current.onRegionPlaced({ x: 0, y: 0, width: 500, height: 500 }));
    act(() => result.current.onPopulate());
    expect(controller.addStamps).not.toHaveBeenCalled();
  });

  it("is deterministic — the same region repopulates identically", () => {
    const first = vi.fn((_drafts: unknown) => ["s1"]);
    const controllerA = makeController({ addStamps: first });
    const hookA = renderHook(() => usePopulate(controllerA));
    act(() => hookA.result.current.onRegionPlaced({ x: 100, y: 100, width: 400, height: 400 }));
    act(() => hookA.result.current.onPopulate());

    const second = vi.fn((_drafts: unknown) => ["s1"]);
    const controllerB = makeController({ addStamps: second });
    const hookB = renderHook(() => usePopulate(controllerB));
    act(() => hookB.result.current.onRegionPlaced({ x: 100, y: 100, width: 400, height: 400 }));
    act(() => hookB.result.current.onPopulate());

    expect(first.mock.calls[0]![0]).toEqual(second.mock.calls[0]![0]);
  });
});
