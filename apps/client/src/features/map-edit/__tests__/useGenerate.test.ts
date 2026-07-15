import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import { useGenerate } from "../useGenerate";
import type { MapStudioController } from "../../map-studio/types";

function doc(grid: Partial<MapDocument["grid"]> = {}): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "live",
    width: 4096,
    height: 4096,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
      ...grid,
    },
    layers: [],
    elements: [],
    revision: 1,
    createdAt: 0,
    updatedAt: 0,
  };
}

function controller(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    activeDocument: doc(),
    saving: false,
    generate: vi.fn(),
    ...overrides,
  } as unknown as MapStudioController;
}

/** A 24x18-cell region at cell (2,2), in document pixels (grid 50, offset 0). */
const DRAG = { x: 100, y: 100, width: 1200, height: 900 };

describe("useGenerate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("converts a dragged pixel rect into the cell bounds the wire expects", () => {
    const ctrl = controller();
    const { result } = renderHook(() => useGenerate(ctrl, true));

    act(() => result.current.onRegionDragged(DRAG));
    act(() => result.current.onGenerate());

    expect(ctrl.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe: "dungeon",
        bounds: { x: 2, y: 2, cols: 24, rows: 18 },
      }),
    );
  });

  it("converts against an ASYMMETRIC grid (equal offsets would hide an x/y swap)", () => {
    const ctrl = controller({ activeDocument: doc({ size: 64, offsetX: 13, offsetY: 7 }) });
    const { result } = renderHook(() => useGenerate(ctrl, true));

    // Cell (3,5) → px (205,327); 10x9 cells → 640x576 px.
    act(() => result.current.onRegionDragged({ x: 205, y: 327, width: 640, height: 576 }));
    act(() => result.current.onGenerate());

    expect(ctrl.generate).toHaveBeenCalledWith(
      expect.objectContaining({ bounds: { x: 3, y: 5, cols: 10, rows: 9 } }),
    );
  });

  it("sends the dials the DM set", () => {
    const ctrl = controller();
    const { result } = renderHook(() => useGenerate(ctrl, true));

    act(() => result.current.onRegionDragged(DRAG));
    act(() =>
      result.current.setParams({
        theme: "wood",
        density: "high",
        secretDoorChance: 0.35,
        seed: 4242,
      }),
    );
    act(() => result.current.onGenerate());

    expect(ctrl.generate).toHaveBeenCalledWith({
      recipe: "dungeon",
      seed: 4242,
      bounds: { x: 2, y: 2, cols: 24, rows: 18 },
      params: { theme: "wood", density: "high", secretDoorChance: 0.35 },
    });
  });

  it("reports the dragged size so the panel can show it", () => {
    const { result } = renderHook(() => useGenerate(controller(), true));
    expect(result.current.region).toBeNull();

    act(() => result.current.onRegionDragged(DRAG));

    expect(result.current.region).toEqual({ cols: 24, rows: 18 });
  });

  describe("gates", () => {
    it("refuses before a region is dragged", () => {
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
    });

    it("refuses when the document is not bound live", () => {
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, false));
      act(() => result.current.onRegionDragged(DRAG));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
    });

    it("refuses while the command queue is busy", () => {
      const ctrl = controller({ saving: true });
      const { result } = renderHook(() => useGenerate(ctrl, true));
      act(() => result.current.onRegionDragged(DRAG));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
    });

    it("explains a too-small region rather than letting the server reject it", () => {
      const notify = vi.fn();
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, notify));

      // 7x7 cells — under the recipe's 8x8 floor.
      act(() => result.current.onRegionDragged({ x: 0, y: 0, width: 350, height: 350 }));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith(expect.stringMatching(/at least 8×8/));
    });

    it("explains a too-large region (the one-command cell cap)", () => {
      const notify = vi.fn();
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, notify));

      // 200x100 = 20000 cells, past the 16384 cap.
      act(() => result.current.onRegionDragged({ x: 0, y: 0, width: 10000, height: 5000 }));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith(expect.stringMatching(/too big/));
    });
  });

  describe("seed", () => {
    it("starts with a seed already rolled, so GENERATE never needs a setup step", () => {
      const { result } = renderHook(() => useGenerate(controller(), true));

      expect(Number.isInteger(result.current.params.seed)).toBe(true);
    });

    it("rerolls to a different seed", () => {
      const { result } = renderHook(() => useGenerate(controller(), true));
      const first = result.current.params.seed;

      act(() => result.current.rerollSeed());

      expect(result.current.params.seed).not.toBe(first);
    });

    it("keeps the same seed across generates, so a repeat rebuilds the same dungeon", () => {
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true));
      act(() => result.current.onRegionDragged(DRAG));

      act(() => result.current.onGenerate());
      act(() => result.current.onGenerate());

      const calls = (ctrl.generate as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[0]![0].seed).toBe(calls[1]![0].seed);
    });
  });
});
