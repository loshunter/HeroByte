// Quick-wheel behaviour (P5): 8 menu items, tool picks dispatch and close,
// brush picks arm the family (re-arming Paint when the active tool doesn't
// consume it) and feed the deck's recents, and Escape closes the WHEEL
// without leaving the underlying map tool.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useToolMode } from "../../../hooks/useToolMode";

vi.mock("../brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));

import { MapEditQuickWheel } from "../MapEditQuickWheel";

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
}

function renderWheel(over: Partial<React.ComponentProps<typeof MapEditQuickWheel>> = {}) {
  const props = {
    x: 400,
    y: 300,
    activeSubTool: "wall" as const,
    floorFamily: "grass",
    onSelectSubTool: vi.fn(),
    onSelectFloorFamily: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<MapEditQuickWheel {...props} />);
  return props;
}

describe("MapEditQuickWheel", () => {
  beforeEach(installMemoryStorage);

  it("renders 8 slots: four tools + four brushes", () => {
    renderWheel();
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(8);
    for (const name of ["Room", "Wall", "Paint", "Erase"]) {
      expect(screen.getByTitle(name)).toBeTruthy();
    }
  });

  it("a tool pick dispatches the sub-tool and closes", () => {
    const props = renderWheel();
    fireEvent.click(screen.getByTitle("Room"));
    expect(props.onSelectSubTool).toHaveBeenCalledWith("room");
    expect(props.onSelectFloorFamily).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("a brush pick arms the family, re-arms Paint, records a recent, closes", () => {
    const props = renderWheel({ activeSubTool: "wall" });
    // Default fill puts the ground shelf first — Path is a brush slot.
    fireEvent.click(screen.getByTitle("Path"));
    expect(props.onSelectFloorFamily).toHaveBeenCalledWith("path");
    expect(props.onSelectSubTool).toHaveBeenCalledWith("terrain");
    expect(window.localStorage.getItem("herobyte:brush-deck:recents")).toContain("path");
    expect(props.onClose).toHaveBeenCalled();
  });

  it("a brush pick keeps a floor-consuming tool (Room stays Room)", () => {
    const props = renderWheel({ activeSubTool: "room" });
    // Path is priority 1 — always the first ground brush, so this pin survives
    // new families joining the shelf.
    fireEvent.click(screen.getByTitle("Path"));
    expect(props.onSelectSubTool).toHaveBeenCalledWith("room");
  });

  it("Escape closes the wheel without exiting the real underlying map tool", () => {
    const tool = renderHook(() => useToolMode());
    act(() => tool.result.current.setActiveTool("map-edit"));
    const props = renderWheel();
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    fireEvent(window, escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(tool.result.current.activeTool).toBe("map-edit");
    expect(props.onSelectSubTool).not.toHaveBeenCalled();
  });

  it("clicking the backdrop closes without dispatching", () => {
    const props = renderWheel();
    const backdrop = document.querySelector('[role="menu"]')!.previousElementSibling!;
    fireEvent.pointerDown(backdrop);
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSelectSubTool).not.toHaveBeenCalled();
  });
});
