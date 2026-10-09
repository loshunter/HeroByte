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
import { ColorPicker, KEY_COMMIT_MS, NOTICE_HOLD_MS, PENDING_TIMEOUT_MS } from "../ColorPicker";
import type { ColorPickerControl } from "../colorPickerControl";

// jsdom has no PointerEvent: without one, fireEvent sends a bare Event with no
// coordinates or button. A MouseEvent carries clientX/clientY/button; pointerId rides along.
if (typeof PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
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

  it("names whose zone the mouse is over before anything is pressed, quietly", () => {
    const { surface, container } = renderPicker();
    fireEvent.pointerMove(surface, { pointerId: 1, ...pixelOf(RED_CELL) });
    expect(screen.getByText("Bors's colour")).toBeTruthy();
    // A hover label is not announced; a bump is.
    expect(container.querySelector(".color-picker__status")!.getAttribute("aria-live")).toBe("off");
    fireEvent.pointerLeave(surface, { pointerType: "mouse" });
    expect(screen.queryByText("Bors's colour")).toBeNull();
  });

  it("labels a zone tapped on a phone for a few seconds after the finger lifts", () => {
    vi.useFakeTimers();
    const { surface, container } = renderPicker();
    const touch = { pointerId: 1, button: 0, pointerType: "touch", ...pixelOf(RED_CELL) };
    fireEvent.pointerDown(surface, touch);
    fireEvent.pointerUp(surface, touch);
    fireEvent.pointerLeave(surface, { pointerType: "touch" });
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    expect(container.querySelector(".color-picker__status")!.getAttribute("aria-live")).toBe(
      "polite",
    );
    act(() => vi.advanceTimersByTime(NOTICE_HOLD_MS));
    expect(screen.queryByText("Too close to Bors")).toBeNull();
  });

  it("keeps the arrow keys on the handle after a press in the window or on a spot", () => {
    const { surface } = renderPicker();
    press(surface, pixelOf(cellAt(0.3, 0.2)));
    expect(document.activeElement).toBe(screen.getByRole("slider"));
    (document.activeElement as HTMLElement).blur();
    fireEvent.click(screen.getByRole("button", { name: /^Suggested colour 1, / }));
    expect(document.activeElement).toBe(screen.getByRole("slider"));
  });

  it("does not let an earlier pick's timeout erase arrow-key steps made after it", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    press(surface, pixelOf(cellAt(0.3, 0.2)));
    // Keys pressed at 1.3 s are still waiting (their commit is due at 1.7 s) when
    // the first pick's 1.5 s timeout fires.
    act(() => vi.advanceTimersByTime(1300));
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    const keyed = screen.getByLabelText("Colour code").textContent;
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByLabelText("Colour code").textContent).toBe(keyed);
  });

  it("counts a finger's small jitter on the handle as a tap, not a pick", () => {
    const { onCommit } = renderPicker();
    const handle = screen.getByRole("slider");
    handle.getBoundingClientRect = () =>
      ({ left: 90, top: 20, width: 20, height: 20, right: 110, bottom: 40 }) as DOMRect;
    const finger = { pointerId: 1, button: 0, pointerType: "touch" };
    fireEvent.pointerDown(handle, { ...finger, clientX: 100, clientY: 30 });
    fireEvent.pointerMove(handle, { ...finger, clientX: 107, clientY: 33 });
    fireEvent.pointerUp(handle, { ...finger, clientX: 107, clientY: 33 });
    expect(onCommit).not.toHaveBeenCalled();
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

  it("sends a held key's colour when focus leaves before the key is released", () => {
    vi.useFakeTimers();
    const { onCommit } = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    fireEvent.blur(screen.getByRole("slider"));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("sends one message when a pointer takes over from keys still waiting", () => {
    vi.useFakeTimers();
    const { onCommit, surface } = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    // A browser moves focus off the handle when the window is pressed: the blur
    // lands between the press and the release.
    const at = { pointerId: 1, button: 0, ...pixelOf(cellAt(0.3, 0.2)) };
    fireEvent.pointerDown(surface, at);
    fireEvent.blur(screen.getByRole("slider"));
    fireEvent.pointerUp(surface, at);
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS + 50));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).toBe(cellAt(0.3, 0.2).hex);
  });

  it("keeps a later pick showing when the answer to an earlier one arrives", () => {
    const { surface, rerender, props } = renderPicker();
    const first = cellAt(0.3, 0.2);
    const second = cellAt(0.4, 0.3);
    press(surface, pixelOf(first));
    press(surface, pixelOf(second));
    act(() => {
      rerender(<ColorPicker {...props} color={first.hex} />);
    });
    expect(screen.getByLabelText("Colour code").textContent).toBe(second.hex);
  });

  it("drops a drag whose pointer capture is lost", () => {
    const { onCommit, surface } = renderPicker();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, ...pixelOf(cellAt(0.3, 0.2)) });
    fireEvent.lostPointerCapture(surface, { pointerId: 1 });
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, ...pixelOf(cellAt(0.3, 0.2)) });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shrinks and moves zones live when someone joins or recolours", () => {
    const { surface, rerender, props } = renderPicker();
    const newcomer = cellAt(0.45, 0.4);
    press(surface, pixelOf(newcomer));
    expect(screen.queryByText(/Too close/)).toBeNull();
    act(() => {
      rerender(
        <ColorPicker
          {...props}
          holders={[
            ...holders,
            { ownerUid: "cy", characterId: "cyra", color: newcomer.hex, name: "Cyra" },
          ]}
        />,
      );
    });
    expect(screen.getByRole("img", { name: "Cyra's colour" })).toBeTruthy();
    press(surface, pixelOf(newcomer));
    expect(screen.getByText("Too close to Cyra")).toBeTruthy();
  });

  it("tells a screen reader an older colour's real lightness, not the band's edge", () => {
    renderPicker({ color: "hsl(240, 70%, 50%)" });
    const text = screen.getByRole("slider").getAttribute("aria-valuetext")!;
    expect(Number(/lightness (\d+)%/.exec(text)![1])).toBeLessThan(50);
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

  it("retires the bump notice a few seconds after the pick", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    press(surface, pixelOf(RED_CELL));
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    act(() => vi.advanceTimersByTime(NOTICE_HOLD_MS));
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
