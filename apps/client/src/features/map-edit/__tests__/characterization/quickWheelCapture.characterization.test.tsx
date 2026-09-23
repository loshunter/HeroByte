// U2 baseline at 44c6ab82. Replace temporary bug pins during ownership repair.
// Not run. Both order-dependent outcomes are temporary pre-extraction pins.
import React, { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MapEditQuickWheel } from "../../MapEditQuickWheel";
import { at, renderMapOwners } from "./mapLifecycle.fixtures";

// Only isolate the asynchronous canvas-thumbnail baker. The wheel, its real
// Escape listener, map tool/cancel/drag hooks, and tool/selection owners stay real.
vi.mock("../../brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));

afterEach(cleanup);

const noSubTool = vi.fn();
const noFloorFamily = vi.fn();

function WheelOwner({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const close = useCallback(() => {
    onClose();
    setOpen(false);
  }, [onClose]);
  return open ? (
    <MapEditQuickWheel
      x={400}
      y={300}
      activeSubTool="wall"
      floorFamily="grass"
      onSelectSubTool={noSubTool}
      onSelectFloorFamily={noFloorFamily}
      onClose={close}
    />
  ) : null;
}

function mountWheel() {
  const onClose = vi.fn();
  render(<WheelOwner onClose={onClose} />);
  expect(screen.getByRole("menu", { name: "Quick wheel" })).toBeInTheDocument();
  return onClose;
}

function beginWall(map: ReturnType<typeof renderMapOwners>) {
  act(() => map.result.current.map.onMouseDown(at(100, 100)));
  act(() => map.result.current.map.onMouseMove(at(200, 100)));
  expect(map.result.current.map.previewDrag).not.toBeNull();
  expect(map.controller.addWall).not.toHaveBeenCalled();
}

function escapeFrom(target: EventTarget) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function assertArmed(map: ReturnType<typeof renderMapOwners>) {
  expect(map.result.current.tool.activeTool).toBe("map-edit");
  expect(map.result.current.selectedObjectId).toBe("token:owned");
}

function commitNextWall(map: ReturnType<typeof renderMapOwners>, previousCount: number) {
  act(() => map.result.current.map.onMouseDown(at(300, 300)));
  act(() => map.result.current.map.onMouseMove(at(400, 300)));
  act(() => map.result.current.map.onMouseUp());
  expect(map.controller.addWall).toHaveBeenCalledTimes(previousCount + 1);
  expect(map.controller.addWall).toHaveBeenLastCalledWith(
    expect.objectContaining({ x1: 300, y1: 300, x2: 400, y2: 300 }),
  );
}

describe("real Quick wheel/map capture ordering before U2", () => {
  it.each(["descendant", "window"] as const)(
    "BASELINE BUG: map-first Escape from %s cancels drag and leaves wheel open",
    (targetKind) => {
      // Separate completed render calls explicitly establish listener order.
      // The real map cancellation listener is armed before the wheel mounts.
      const map = renderMapOwners("wall");
      beginWall(map);
      const onClose = mountWheel();
      expect(map.result.current.map.previewDrag).not.toBeNull();
      const target = targetKind === "window" ? window : screen.getAllByRole("menuitem")[0]!;

      const event = escapeFrom(target);

      expect(event.defaultPrevented).toBe(true);
      expect(map.result.current.map.previewDrag).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("menu", { name: "Quick wheel" })).toBeInTheDocument();
      assertArmed(map);
      act(() => map.result.current.map.onMouseUp());
      expect(map.controller.addWall).not.toHaveBeenCalled();

      // With no remaining drag the next Escape finally reaches the wheel.
      escapeFrom(screen.getAllByRole("menuitem")[0]!);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu", { name: "Quick wheel" })).not.toBeInTheDocument();
      assertArmed(map);
      commitNextWall(map, 0);
    },
  );

  it.each(["descendant", "window"] as const)(
    "BASELINE BUG: wheel-first Escape from %s closes wheel but leaves drag commit-ready",
    (targetKind) => {
      // The wheel captures first; arming the real map hook registers second.
      // Direct hook input deliberately creates an overlap beneath the wheel.
      // This proves arbitration, not that a physical pointer can cross it.
      const onClose = mountWheel();
      const map = renderMapOwners("wall");
      beginWall(map);
      const target = targetKind === "window" ? window : screen.getAllByRole("menuitem")[0]!;

      const event = escapeFrom(target);

      expect(event.defaultPrevented).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu", { name: "Quick wheel" })).not.toBeInTheDocument();
      expect(map.result.current.map.previewDrag).not.toBeNull();
      expect(map.controller.addWall).not.toHaveBeenCalled();
      assertArmed(map);

      act(() => map.result.current.map.onMouseUp());
      expect(map.controller.addWall).toHaveBeenCalledTimes(1);
      expect(map.controller.addWall).toHaveBeenCalledWith(
        expect.objectContaining({ x1: 100, y1: 100, x2: 200, y2: 100 }),
      );
      expect(map.result.current.map.previewDrag).toBeNull();
      assertArmed(map);
      commitNextWall(map, 1);
    },
  );
});
