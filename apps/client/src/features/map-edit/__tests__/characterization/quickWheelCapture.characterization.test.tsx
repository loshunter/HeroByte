import React, { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MapEditQuickWheel } from "../../MapEditQuickWheel";
import { at, renderMapOwners } from "./mapLifecycle.fixtures";

// Only isolate the asynchronous canvas-thumbnail baker. The wheel, its real
// Escape owner, map tool/cancel/drag hooks, and tool/selection owners stay real.
vi.mock("../../brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

function beginWall(map: ReturnType<typeof renderMapOwners>, previousCount = 0) {
  act(() => map.result.current.map.onMouseDown(at(100, 100)));
  act(() => map.result.current.map.onMouseMove(at(200, 100)));
  expect(map.result.current.map.previewDrag).not.toBeNull();
  expect(map.controller.addWall).toHaveBeenCalledTimes(previousCount);
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

function wheelTarget(targetKind: "descendant" | "window") {
  return targetKind === "window" ? window : screen.getAllByRole("menuitem")[0]!;
}

function assertClosed(onClose: ReturnType<typeof vi.fn>) {
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("menu", { name: "Quick wheel" })).not.toBeInTheDocument();
  expect(noSubTool).not.toHaveBeenCalled();
  expect(noFloorFamily).not.toHaveBeenCalled();
}

function exerciseLadder(
  map: ReturnType<typeof renderMapOwners>,
  onClose: ReturnType<typeof vi.fn>,
  targetKind: "descendant" | "window",
) {
  // A popover owns the first step, independent of which real owner mounted first.
  expect(escapeFrom(wheelTarget(targetKind)).defaultPrevented).toBe(true);
  assertClosed(onClose);
  expect(map.result.current.map.previewDrag).not.toBeNull();
  expect(map.controller.addWall).not.toHaveBeenCalled();
  assertArmed(map);

  // No wheel remains; the next step cancels unsent work, retaining tool/selection.
  const held = map.result.current.map;
  expect(escapeFrom(window).defaultPrevented).toBe(true);
  expect(map.result.current.map.previewDrag).toBeNull();
  assertArmed(map);
  act(() => {
    held.onMouseMove(at(250, 150));
    held.onMouseUp();
    held.onMouseUp();
  });
  expect(map.controller.addWall).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
  assertArmed(map);
  commitNextWall(map, 0);
  assertArmed(map);

  // Preserve the old wheel-first release control: closing ONLY a popover does
  // not discard the wall. Release commits it once, without requiring another press.
  beginWall(map, 1);
  const closeOnly = mountWheel();
  expect(escapeFrom(wheelTarget(targetKind)).defaultPrevented).toBe(true);
  assertClosed(closeOnly);
  expect(map.result.current.map.previewDrag).not.toBeNull();
  expect(map.controller.addWall).toHaveBeenCalledTimes(1);
  act(() => map.result.current.map.onMouseUp());
  expect(map.controller.addWall).toHaveBeenCalledTimes(2);
  expect(map.controller.addWall).toHaveBeenLastCalledWith(
    expect.objectContaining({ x1: 100, y1: 100, x2: 200, y2: 100 }),
  );
  expect(map.result.current.map.previewDrag).toBeNull();
  assertArmed(map);

  // After work is complete, the remaining ladder steps are still independent.
  expect(escapeFrom(window).defaultPrevented).toBe(true);
  expect(map.result.current.tool.activeTool).toBeNull();
  expect(map.result.current.selectedObjectId).toBe("token:owned");
  expect(escapeFrom(window).defaultPrevented).toBe(true);
  expect(map.result.current.selectedObjectId).toBeNull();
  expect(map.controller.addWall).toHaveBeenCalledTimes(2);
  expect(escapeFrom(window).defaultPrevented).toBe(false);
}

describe("real Quick wheel and map owners follow the same Escape ladder", () => {
  it.each(["descendant", "window"] as const)(
    "map-first Escape from %s closes wheel before canceling the pending wall",
    (targetKind) => {
      // Separate completed mounts retain the original registration-order control.
      const map = renderMapOwners("wall");
      beginWall(map);
      const onClose = mountWheel();
      expect(map.result.current.map.previewDrag).not.toBeNull();
      exerciseLadder(map, onClose, targetKind);
    },
  );

  it.each(["descendant", "window"] as const)(
    "wheel-first Escape from %s closes wheel before canceling the pending wall",
    (targetKind) => {
      const onClose = mountWheel();
      const map = renderMapOwners("wall");
      // Direct hook input deliberately creates an overlap beneath the wheel.
      // This proves ownership arbitration, not physical pointer reachability.
      beginWall(map);
      exerciseLadder(map, onClose, targetKind);
    },
  );
});
