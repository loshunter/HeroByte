import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMapEditDragPreview } from "../useMapEditDragPreview";

// The rAF throttle is the whole point of this hook, so the frames are driven by
// hand rather than waited on: a real frame in jsdom would make every assertion
// below a race.
function installManualRaf() {
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    pending.delete(id);
  });
  return {
    pendingCount: () => pending.size,
    runFrames: () => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

describe("useMapEditDragPreview", () => {
  let raf: ReturnType<typeof installManualRaf>;

  beforeEach(() => {
    raf = installManualRaf();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("paints the press immediately — a drag that only shows on the next move reads as a dropped tap", () => {
    const { result } = renderHook(() => useMapEditDragPreview());

    act(() => result.current.begin({ x: 10, y: 20 }));

    expect(result.current.previewDrag).toEqual({ start: { x: 10, y: 20 }, end: { x: 10, y: 20 } });
    expect(raf.pendingCount()).toBe(0);
  });

  it("keeps the ref ahead of the paint: current() is exact while previewDrag waits for a frame", () => {
    const { result } = renderHook(() => useMapEditDragPreview());

    act(() => result.current.begin({ x: 0, y: 0 }));
    act(() => result.current.extend({ x: 50, y: 50 }));

    // The commit path reads current(), so it must already see the new end.
    expect(result.current.current()).toEqual({ start: { x: 0, y: 0 }, end: { x: 50, y: 50 } });
    expect(result.current.previewDrag).toEqual({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 } });

    act(() => raf.runFrames());
    expect(result.current.previewDrag).toEqual({ start: { x: 0, y: 0 }, end: { x: 50, y: 50 } });
  });

  it("coalesces a burst of moves into ONE frame", () => {
    const { result } = renderHook(() => useMapEditDragPreview());

    act(() => result.current.begin({ x: 0, y: 0 }));
    act(() => {
      result.current.extend({ x: 10, y: 0 });
      result.current.extend({ x: 20, y: 0 });
      result.current.extend({ x: 30, y: 0 });
    });

    expect(raf.pendingCount()).toBe(1);
    act(() => raf.runFrames());
    expect(result.current.previewDrag).toEqual({ start: { x: 0, y: 0 }, end: { x: 30, y: 0 } });
  });

  it("ignores a move with no drag in flight — a finger that never pressed cannot paint", () => {
    const { result } = renderHook(() => useMapEditDragPreview());

    act(() => result.current.extend({ x: 99, y: 99 }));

    expect(result.current.current()).toBeNull();
    expect(result.current.previewDrag).toBeNull();
    expect(raf.pendingCount()).toBe(0);
  });

  it("clear() drops the pending frame too, so a cancelled drag cannot repaint itself", () => {
    const { result } = renderHook(() => useMapEditDragPreview());

    act(() => result.current.begin({ x: 0, y: 0 }));
    act(() => result.current.extend({ x: 80, y: 80 }));
    expect(raf.pendingCount()).toBe(1);

    act(() => result.current.clear());

    expect(raf.pendingCount()).toBe(0);
    expect(result.current.current()).toBeNull();
    expect(result.current.previewDrag).toBeNull();

    // Nothing left to run, and running anyway must not resurrect the preview.
    act(() => raf.runFrames());
    expect(result.current.previewDrag).toBeNull();
  });

  it("cancels a pending frame on unmount rather than setting state on a dead hook", () => {
    const { result, unmount } = renderHook(() => useMapEditDragPreview());

    act(() => result.current.begin({ x: 0, y: 0 }));
    act(() => result.current.extend({ x: 5, y: 5 }));
    expect(raf.pendingCount()).toBe(1);

    unmount();

    expect(raf.pendingCount()).toBe(0);
  });

  it("hands out stable begin/extend/clear/current identities — the tool hook lists them as deps", () => {
    const { result, rerender } = renderHook(() => useMapEditDragPreview());
    const first = { ...result.current };

    act(() => result.current.begin({ x: 1, y: 1 }));
    rerender();

    expect(result.current.begin).toBe(first.begin);
    expect(result.current.extend).toBe(first.extend);
    expect(result.current.clear).toBe(first.clear);
    expect(result.current.current).toBe(first.current);
  });
});
