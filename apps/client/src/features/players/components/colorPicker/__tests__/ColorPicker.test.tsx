import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  cellIndexAt,
  colorToOkLab,
  deltaE,
  ruleRadius,
  windowCells,
  type ColorHolder,
  type WindowCell,
} from "@herobyte/shared";
import { ColorPicker, KEY_COMMIT_MS, PENDING_TIMEOUT_MS } from "../ColorPicker";
import type { ColorPickerControl } from "../colorPickerControl";

// jsdom has no PointerEvent: without one, fireEvent sends a bare Event with no
// coordinates or button. A MouseEvent carries clientX/clientY/button; pointerId rides along.
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
// The canvas inside the window's border: what the picker measures.
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
  const canvas = surface.querySelector("canvas")!;
  canvas.getBoundingClientRect = () => ({ ...RECT, toJSON: () => RECT }) as DOMRect;
  return { ...view, onCommit, surface, props };
}

/** The pixel at a window cell's centre on the test canvas. */
const pixelOf = (cell: WindowCell) => ({
  clientX: cell.u * RECT.width,
  clientY: cell.v * RECT.height,
});
const press = (surface: HTMLElement, at: { clientX: number; clientY: number }, id = 1) => {
  fireEvent.pointerDown(surface, { pointerId: id, button: 0, ...at });
  fireEvent.pointerUp(surface, { pointerId: id, button: 0, ...at });
};

describe("ColorPicker", () => {
  // jsdom has no 2D canvas either; the window's pixels are the one part not drawn here.
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("names the handle and reads out the colour", () => {
    renderPicker();
    expect(screen.getByRole("slider", { name: "Mine's colour" })).toBeTruthy();
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
  });

  it("reads an older hsl colour out as the hex it is", () => {
    renderPicker({ color: "hsl(120, 70%, 50%)" });
    expect(screen.getByLabelText("Colour code").textContent).toBe("#26d926");
  });

  it("tells a screen reader the real lightness, inside the window's band", () => {
    renderPicker();
    const text = screen.getByRole("slider").getAttribute("aria-valuetext")!;
    const lightness = Number(/lightness (\d+)%/.exec(text)![1]);
    expect(lightness).toBeGreaterThanOrEqual(64);
    expect(lightness).toBeLessThanOrEqual(88);
  });

  it("lands on a suggested spot in one tap and commits exactly that colour", () => {
    const { onCommit } = renderPicker();
    const spot = screen.getByRole("button", { name: /^Suggested colour 1, #[0-9a-f]{6}$/ });
    fireEvent.click(spot);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(spot.getAttribute("aria-label")!.split(", ")[1]);
  });

  it("stops a drag at the edge of another player's zone and says whose it is", () => {
    const { onCommit, surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, ...pixelOf(RED_CELL) });
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, ...pixelOf(RED_CELL) });
    expect(onCommit).toHaveBeenCalledTimes(1);
    const room = deltaE(colorToOkLab(onCommit.mock.calls[0]![0])!, colorToOkLab(RED)!);
    expect(room).toBeGreaterThanOrEqual(ruleRadius(2));
  });

  it("names whose zone the pointer is over before anything is pressed", () => {
    const { surface } = renderPicker();
    fireEvent.pointerMove(surface, { pointerId: 1, ...pixelOf(RED_CELL) });
    expect(screen.getByText("Bors's colour")).toBeTruthy();
    fireEvent.pointerLeave(surface);
    expect(screen.queryByText("Bors's colour")).toBeNull();
  });

  it("commits once on release, not on every move", () => {
    const { onCommit, surface } = renderPicker();
    const spot = { u: 0.3, v: 0.2 };
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 60, clientY: 20 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: spot.u * 360, clientY: spot.v * 120 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(surface, {
      pointerId: 1,
      button: 0,
      clientX: spot.u * 360,
      clientY: spot.v * 120,
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("picks nothing on a tap of the handle itself", () => {
    const { onCommit } = renderPicker();
    const handle = screen.getByRole("slider");
    // Boxed over a clearly different colour, so only the tap rule (not the grab
    // offset landing back on the same cell) can keep this from committing.
    handle.getBoundingClientRect = () =>
      ({ left: 90, top: 20, width: 20, height: 20, right: 110, bottom: 40 }) as DOMRect;
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 108, clientY: 22 });
    fireEvent.pointerUp(handle, { pointerId: 1, button: 0, clientX: 108, clientY: 22 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("ignores a right-click and a second finger", () => {
    const { onCommit, surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 2, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(surface, { pointerId: 1, button: 2, clientX: 30, clientY: 30 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 30, clientY: 30 });
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 90 });
    fireEvent.pointerUp(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 90 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, clientX: 30, clientY: 30 });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("lets the DM drop anywhere: no zones, no spots, no bump", () => {
    const { onCommit, surface } = renderPicker({ exempt: true });
    expect(screen.queryByRole("button", { name: /Suggested colour/ })).toBeNull();
    press(surface, pixelOf(RED_CELL));
    expect(screen.queryByText(/Too close/)).toBeNull();
    expect(onCommit.mock.calls[0]![0]).toBe(RED);
  });

  it("keeps the arrow keys away from the table's own keys (a selected token must not walk)", () => {
    vi.useFakeTimers();
    renderPicker();
    const tableKeys = vi.fn();
    window.addEventListener("keydown", tableKeys);
    try {
      fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
      expect(tableKeys).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", tableKeys);
    }
  });

  it("commits arrow-key steps once the keys go quiet: one message for many presses", () => {
    vi.useFakeTimers();
    const { onCommit } = renderPicker();
    const handle = screen.getByRole("slider");
    for (let step = 0; step < 4; step += 1) {
      fireEvent.keyDown(handle, { key: "ArrowUp" });
      fireEvent.keyUp(handle, { key: "ArrowUp" });
    }
    expect(onCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS));
    expect(onCommit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(handle, { key: "a" });
    fireEvent.keyUp(handle, { key: "a" });
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("sends the keyed colour when focus leaves, and when the window closes", () => {
    vi.useFakeTimers();
    const first = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    fireEvent.keyUp(screen.getByRole("slider"), { key: "ArrowUp" });
    fireEvent.blur(screen.getByRole("slider"));
    expect(first.onCommit).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowDown" });
    fireEvent.keyUp(screen.getByRole("slider"), { key: "ArrowDown" });
    second.unmount();
    expect(second.onCommit).toHaveBeenCalledTimes(1);
  });

  it("does not send a colour it already has", () => {
    const { onCommit, surface } = renderPicker();
    press(surface, pixelOf(BLUE_CELL));
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

  it("stops showing a pick the server answered without changing the colour", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    const spot = cellAt(0.3, 0.2);
    press(surface, pixelOf(spot));
    expect(screen.getByLabelText("Colour code").textContent).toBe(spot.hex);
    act(() => vi.advanceTimersByTime(PENDING_TIMEOUT_MS));
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
  });

  it("retires the bump notice once the colour has changed", () => {
    const { surface, rerender, props } = renderPicker();
    press(surface, pixelOf(RED_CELL));
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    act(() => {
      rerender(<ColorPicker {...props} color={cellAt(0.45, 0.4).hex} />);
    });
    expect(screen.queryByText(/Too close/)).toBeNull();
  });

  it("forgets a cancelled drag and its notice", () => {
    const { surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, ...pixelOf(RED_CELL) });
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
    expect(screen.queryByText(/Too close/)).toBeNull();
  });
});
