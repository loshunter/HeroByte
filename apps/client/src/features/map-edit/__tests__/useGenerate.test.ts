import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import { useGenerate } from "../useGenerate";
import type { MapEditSubTool } from "../mapEditTypes";
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

/** A 24x20-cell region at cell (2,2), in document pixels (grid 50, offset 0). */
const DRAG = { x: 100, y: 100, width: 1200, height: 1000 };

describe("useGenerate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("drops the aimed region when the ACTIVE DOCUMENT changes underneath it (travel repoints the palette)", () => {
    const ctrl1 = controller();
    const { result, rerender } = renderHook(({ c }) => useGenerate(c, true, "generate", true), {
      initialProps: { c: ctrl1 },
    });
    act(() => result.current.onRegionDragged(DRAG));
    expect(result.current.region).not.toBeNull();

    const other = controller();
    (other.activeDocument as { id: string }).id = "another-document";
    rerender({ c: other });
    expect(result.current.region).toBeNull();
    act(() => result.current.onGenerate());
    expect(other.generate).not.toHaveBeenCalled();
  });

  it("converts a dragged pixel rect into the cell bounds the wire expects", () => {
    const ctrl = controller();
    const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true));

    act(() => result.current.onRegionDragged(DRAG));
    act(() => result.current.onGenerate());

    expect(ctrl.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe: "dungeon",
        bounds: { x: 2, y: 2, cols: 24, rows: 20 },
      }),
    );
  });

  it("converts against an ASYMMETRIC grid (equal offsets would hide an x/y swap)", () => {
    const ctrl = controller({ activeDocument: doc({ size: 64, offsetX: 13, offsetY: 7 }) });
    const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true));

    // Cell (3,5) → px (205,327); 22x21 cells → 1408x1344 px.
    act(() => result.current.onRegionDragged({ x: 205, y: 327, width: 1408, height: 1344 }));
    act(() => result.current.onGenerate());

    expect(ctrl.generate).toHaveBeenCalledWith(
      expect.objectContaining({ bounds: { x: 3, y: 5, cols: 22, rows: 21 } }),
    );
  });

  it("sends the dials the DM set", () => {
    const ctrl = controller();
    const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true));

    act(() => result.current.onRegionDragged(DRAG));
    act(() =>
      result.current.setParams({
        theme: "wood",
        density: "high",
        seed: 4242,
      }),
    );
    act(() => result.current.onGenerate());

    // The seed rides beside params, not inside them: it identifies the dungeon,
    // the params describe it. The server's schema is strict, so an extra field
    // here would be a rejected message rather than an ignored one.
    expect(ctrl.generate).toHaveBeenCalledWith({
      recipe: "dungeon",
      seed: 4242,
      bounds: { x: 2, y: 2, cols: 24, rows: 20 },
      params: { theme: "wood", density: "high" },
    });
  });

  it("reports the dragged size so the panel can show it", () => {
    const { result } = renderHook(() => useGenerate(controller(), true, "generate", true));
    expect(result.current.region).toBeNull();

    act(() => result.current.onRegionDragged(DRAG));

    expect(result.current.region).toEqual({ cols: 24, rows: 20 });
  });

  describe("gates", () => {
    it("refuses before a region is dragged", () => {
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
    });

    it("refuses when the document is not bound live", () => {
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, false, "generate", true));
      act(() => result.current.onRegionDragged(DRAG));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
    });

    it("refuses while the command queue is busy", () => {
      const ctrl = controller({ saving: true });
      const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true));
      act(() => result.current.onRegionDragged(DRAG));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
    });

    it("explains a too-small region rather than letting the server reject it", () => {
      const notify = vi.fn();
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true, notify));

      // 19x19 cells — one under the recipe's 20x20 floor, where a region fits a
      // single sealed room instead of a dungeon. The client must agree with the
      // server's floor EXACTLY, or GENERATE enables for regions the server then
      // refuses.
      act(() => result.current.onRegionDragged({ x: 0, y: 0, width: 950, height: 950 }));

      expect(result.current.canGenerate).toBe(false);
      act(() => result.current.onGenerate());
      expect(ctrl.generate).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith(expect.stringMatching(/at least 20×20/));
    });

    it("accepts exactly the 20x20 floor", () => {
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true));

      act(() => result.current.onRegionDragged({ x: 0, y: 0, width: 1000, height: 1000 }));

      expect(result.current.canGenerate).toBe(true);
    });

    it("explains a too-large region (the one-command cell cap)", () => {
      const notify = vi.fn();
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true, notify));

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
      const { result } = renderHook(() => useGenerate(controller(), true, "generate", true));

      expect(Number.isInteger(result.current.params.seed)).toBe(true);
    });

    it("rerolls to a different seed", () => {
      const { result } = renderHook(() => useGenerate(controller(), true, "generate", true));
      const first = result.current.params.seed;

      act(() => result.current.rerollSeed());

      expect(result.current.params.seed).not.toBe(first);
    });

    // This replaces "keeps the same seed across generates, so a repeat rebuilds
    // the same dungeon", which pinned the behaviour below as desirable. It is
    // not: the recipe is pure, so a repeat with nothing changed does not
    // rebuild, it stacks an identical copy and one undo removes only the copy.
    it("refuses an unchanged repeat, and the reroll is what re-arms it", () => {
      const notify = vi.fn();
      const ctrl = controller();
      const { result } = renderHook(() => useGenerate(ctrl, true, "generate", true, notify));
      act(() => result.current.onRegionDragged(DRAG));

      act(() => result.current.onGenerate());
      expect(ctrl.generate).toHaveBeenCalledTimes(1);
      const firstSeed = (ctrl.generate as ReturnType<typeof vi.fn>).mock.calls[0]![0].seed;

      // Same region, same dials, same seed — nothing to build that is not there.
      act(() => result.current.onGenerate());
      expect(ctrl.generate).toHaveBeenCalledTimes(1);
      expect(result.current.canGenerate).toBe(false);
      expect(result.current.hint).toMatch(/already/i);
      expect(notify).toHaveBeenCalledWith(expect.stringMatching(/already/i));

      // Rerolling changes the recipe, so the same rectangle is fair game again
      // — this is the try-another-dungeon-here workflow, and it must survive.
      act(() => result.current.rerollSeed());
      expect(result.current.canGenerate).toBe(true);
      expect(result.current.hint).toBeNull();

      act(() => result.current.onGenerate());
      expect(ctrl.generate).toHaveBeenCalledTimes(2);
      const secondSeed = (ctrl.generate as ReturnType<typeof vi.fn>).mock.calls[1]![0].seed;
      expect(secondSeed).not.toBe(firstSeed);
    });

    it("forgets the aimed region when the tool is disarmed", () => {
      const ctrl = controller();
      const { result, rerender } = renderHook(
        ({ subTool }: { subTool: MapEditSubTool }) => useGenerate(ctrl, true, subTool, true),
        { initialProps: { subTool: "generate" as MapEditSubTool } },
      );
      act(() => result.current.onRegionDragged(DRAG));
      expect(result.current.region).toEqual({ cols: 24, rows: 20 });

      // Switching to another tool. The rubber band was dropped on release, so
      // a region kept past this point is armed for something invisible.
      rerender({ subTool: "wall" });
      expect(result.current.region).toBeNull();
      expect(result.current.canGenerate).toBe(false);

      // Re-arming does NOT resurrect it — the DM aims again.
      rerender({ subTool: "generate" });
      expect(result.current.region).toBeNull();
    });

    it("forgets it when the DM leaves map-edit with GENERATE still selected", () => {
      const ctrl = controller();
      const { result, rerender } = renderHook(
        ({ mode }: { mode: boolean }) => useGenerate(ctrl, true, "generate", mode),
        { initialProps: { mode: true } },
      );
      act(() => result.current.onRegionDragged(DRAG));
      expect(result.current.region).toEqual({ cols: 24, rows: 20 });

      // The other way out, and the one the sub-tool half cannot see:
      // activeSubTool is App-level state that outlives the mode, so it is
      // still "generate" here. Only the mode half of `armed` can fall.
      rerender({ mode: false });
      expect(result.current.region).toBeNull();

      // Reopening map-edit does not bring the old rectangle back with it.
      rerender({ mode: true });
      expect(result.current.region).toBeNull();
      expect(result.current.canGenerate).toBe(false);
    });
  });

  // `canGenerate` folding regionProblem in DISABLES the button, which made the
  // notifyError inside onGenerate unreachable for a bad region — a mute dead
  // button. These pin the reason reaching the panel instead.
  describe("the reason GENERATE is refused", () => {
    // Grid 50: cells x 50 = pixels.
    const cells = (n: number) => ({ x: 0, y: 0, width: n * 50, height: n * 50 });

    it("names a too-small region, then clears once the region is big enough", () => {
      const { result } = renderHook(() => useGenerate(controller(), true, "generate", true));

      act(() => result.current.onRegionDragged(cells(10)));
      expect(result.current.canGenerate).toBe(false);
      expect(result.current.hint).toMatch(/20/);

      // The second region is the half that matters: a hint hard-coded to a
      // constant satisfies the first assertion and dies here.
      act(() => result.current.onRegionDragged(cells(40)));
      expect(result.current.canGenerate).toBe(true);
      expect(result.current.hint).toBeNull();
    });

    it("gives too-small and too-big DIFFERENT reasons", () => {
      const { result } = renderHook(() => useGenerate(controller(), true, "generate", true));

      act(() => result.current.onRegionDragged(cells(10)));
      const tooSmall = result.current.hint;
      act(() => result.current.onRegionDragged(cells(200))); // 40000 > 16384 cells
      const tooBig = result.current.hint;

      expect(tooSmall).toBeTruthy();
      expect(tooBig).toBeTruthy();
      expect(tooBig).not.toBe(tooSmall);
    });

    it("stays silent before the first drag — the region label covers that case", () => {
      const { result } = renderHook(() => useGenerate(controller(), true, "generate", true));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.hint).toBeNull();
    });
  });
});
