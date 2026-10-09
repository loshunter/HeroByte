import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { cellIndexAt, windowCells, type ColorHolder, type WindowCell } from "@herobyte/shared";
import { ColorPicker } from "../ColorPicker";
import type { ColorPickerControl } from "../colorPickerModel";

// jsdom has no PointerEvent: without one, fireEvent sends a bare Event with no
// coordinates. A MouseEvent carries clientX/clientY; pointerId rides along.
if (typeof PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;
}

const cellAt = (u: number, v: number): WindowCell => windowCells()[cellIndexAt({ u, v })]!;
const RED_CELL = cellAt(0.08, 0.5);
const BLUE_CELL = cellAt(0.7, 0.5);
const RED = RED_CELL.hex;
const BLUE = BLUE_CELL.hex;
const holders: ColorHolder[] = [
  { ownerUid: "me", characterId: "mine", color: BLUE, name: "Mine" },
  { ownerUid: "sam", characterId: "bors", color: RED, name: "Bors" },
];
const RECT = { left: 0, top: 0, width: 360, height: 120, right: 360, bottom: 120, x: 0, y: 0 };

function renderPicker(overrides: Partial<ColorPickerControl> = {}) {
  const onCommit = vi.fn();
  const props: ColorPickerControl = {
    color: BLUE,
    holders,
    dmUids: [],
    ownerUid: "me",
    characterId: "mine",
    name: "Mine",
    exempt: false,
    onCommit,
    ...overrides,
  };
  const view = render(<ColorPicker {...props} />);
  const surface = screen.getByTestId("color-picker-window");
  surface.getBoundingClientRect = () => ({ ...RECT, toJSON: () => RECT }) as DOMRect;
  return { ...view, onCommit, surface, props };
}

/** The pixel at a window cell's centre on the test window. */
const pixelOf = (cell: WindowCell) => ({
  clientX: cell.u * RECT.width,
  clientY: cell.v * RECT.height,
});

describe("ColorPicker", () => {
  // jsdom has no 2D canvas either; the window's pixels are the one part not drawn here.
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  });
  afterEach(() => vi.restoreAllMocks());

  it("names the handle and reads out the colour", () => {
    renderPicker();
    expect(screen.getByRole("slider", { name: "Mine's colour" })).toBeTruthy();
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
  });

  it("lands on a suggested spot in one tap and commits it", () => {
    const { onCommit } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Suggested colour 1" }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("stops a drag at the edge of another player's zone and says whose it is", () => {
    const { onCommit, surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, ...pixelOf(RED_CELL) });
    expect(screen.getByText("Too close to Bors's colour")).toBeTruthy();
    fireEvent.pointerUp(surface, { pointerId: 1, ...pixelOf(RED_CELL) });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).not.toBe(RED);
  });

  it("commits once on release, not on every move", () => {
    const { onCommit, surface } = renderPicker();
    const spot = { u: 0.3, v: 0.2 };
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 60, clientY: 20 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: spot.u * 360, clientY: spot.v * 120 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: spot.u * 360, clientY: spot.v * 120 });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("lets the DM drop anywhere: no zones, no spots, no bump", () => {
    const { onCommit, surface } = renderPicker({ exempt: true });
    expect(screen.queryByRole("button", { name: /Suggested colour/ })).toBeNull();
    fireEvent.pointerDown(surface, { pointerId: 1, ...pixelOf(RED_CELL) });
    fireEvent.pointerUp(surface, { pointerId: 1, ...pixelOf(RED_CELL) });
    expect(screen.queryByText(/Too close/)).toBeNull();
    expect(onCommit.mock.calls[0]![0]).toBe(RED);
  });

  it("steps with the arrow keys and commits on release", () => {
    const { onCommit } = renderPicker();
    const handle = screen.getByRole("slider");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.keyDown(handle, { key: "ArrowUp", shiftKey: true });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(handle, { key: "ArrowUp" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(handle, { key: "a" });
    fireEvent.keyUp(handle, { key: "a" });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not send a colour it already has", () => {
    const { onCommit, surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, ...pixelOf(BLUE_CELL) });
    fireEvent.pointerUp(surface, { pointerId: 1, ...pixelOf(BLUE_CELL) });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("follows the server's answer when the colour changes under it", () => {
    const { rerender, props } = renderPicker();
    const snapped = cellAt(0.45, 0.4).hex;
    act(() => {
      rerender(<ColorPicker {...props} color={snapped} />);
    });
    expect(screen.getByLabelText("Colour code").textContent).toBe(snapped);
  });

  it("forgets a cancelled drag", () => {
    const { surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 30, clientY: 30 });
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
  });
});
