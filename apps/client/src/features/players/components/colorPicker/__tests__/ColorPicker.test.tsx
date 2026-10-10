import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  COLOR_WINDOW,
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
/** A press that travels well past the tap slop before it lifts. */
const dragTo = (
  surface: HTMLElement,
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number },
  lift = true,
) => {
  fireEvent.pointerDown(surface, { pointerId: 1, button: 0, ...from });
  fireEvent.pointerMove(surface, { pointerId: 1, button: 0, ...to });
  if (lift) fireEvent.pointerUp(surface, { pointerId: 1, button: 0, ...to });
};
/** Inside Bors's zone, a little way from his colour itself (well past a tap's slop). */
const NEAR_RED_CELL = cellAt(0.11, 0.55);

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
    expect(lightness).toBe(Math.round(colorToOkLab(BLUE)!.L * 100));
    expect(lightness).toBeGreaterThanOrEqual(COLOR_WINDOW.lightMin * 100);
    expect(lightness).toBeLessThanOrEqual(COLOR_WINDOW.lightMax * 100);
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
    dragTo(surface, pixelOf(NEAR_RED_CELL), pixelOf(RED_CELL), false);
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
    expect(container.querySelector(".color-picker__status [aria-live]")!.textContent).toBe("");
    fireEvent.pointerLeave(surface, { pointerType: "mouse" });
    expect(screen.queryByText("Bors's colour")).toBeNull();
  });

  it("picks the nearest free colour for a zone tapped on a phone, and names whose it is", () => {
    vi.useFakeTimers();
    const { surface, container, onCommit } = renderPicker();
    const touch = { pointerId: 1, button: 0, pointerType: "touch", ...pixelOf(NEAR_RED_CELL) };
    fireEvent.pointerDown(surface, touch);
    fireEvent.pointerUp(surface, touch);
    fireEvent.pointerLeave(surface, { pointerType: "touch" });
    expect(container.querySelector(".color-picker__status [aria-live='polite']")!.textContent).toBe(
      "Too close to Bors",
    );
    // One pick: the nearest free colour, just outside Bors's zone.
    expect(onCommit).toHaveBeenCalledTimes(1);
    const room = deltaE(colorToOkLab(onCommit.mock.calls[0]![0])!, colorToOkLab(RED)!);
    expect(room).toBeGreaterThanOrEqual(ruleRadius(2));
    expect(room).toBeLessThan(ruleRadius(2) + 0.03);
    expect(screen.getByLabelText("Colour code").textContent).toBe(onCommit.mock.calls[0]![0]);
    act(() => vi.advanceTimersByTime(NOTICE_HOLD_MS));
    expect(screen.queryByText("Too close to Bors")).toBeNull();
  });

  it("names a zone under the mouse again once a tap's label has gone", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    press(surface, pixelOf(NEAR_RED_CELL));
    act(() => vi.advanceTimersByTime(NOTICE_HOLD_MS));
    expect(screen.queryByText("Bors's colour")).toBeNull();
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: "mouse", ...pixelOf(RED_CELL) });
    expect(screen.getByText("Bors's colour")).toBeTruthy();
  });

  it("lets a tap in a zone take over from keys still waiting: one message, the tap's", () => {
    vi.useFakeTimers();
    const { surface, onCommit } = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    const keyed = screen.getByLabelText("Colour code").textContent;
    press(surface, pixelOf(NEAR_RED_CELL));
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0]).not.toBe(keyed);
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
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
    // The colour where it was released, not where it was pressed.
    expect(onCommit.mock.calls).toEqual([[cellAt(spot.u, spot.v).hex]]);
  });

  it("commits a drag from a free colour into a zone at that zone's nearest edge", () => {
    const { onCommit, surface } = renderPicker();
    dragTo(surface, pixelOf(cellAt(0.3, 0.2)), pixelOf(RED_CELL));
    expect(onCommit).toHaveBeenCalledTimes(1);
    const room = deltaE(colorToOkLab(onCommit.mock.calls[0]![0])!, colorToOkLab(RED)!);
    expect(room).toBeGreaterThanOrEqual(ruleRadius(2));
    expect(room).toBeLessThan(ruleRadius(2) + 0.03);
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
    fireEvent.pointerDown(surface, { pointerId: 1, button: 2, clientX: 108, clientY: 24 });
    fireEvent.pointerUp(surface, { pointerId: 1, button: 2, clientX: 108, clientY: 24 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 108, clientY: 24 });
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 90 });
    fireEvent.pointerUp(surface, { pointerId: 2, button: 0, clientX: 200, clientY: 90 });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, clientX: 108, clientY: 24 });
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

  it("never pulls the handle back from keys still choosing when an earlier answer arrives", () => {
    vi.useFakeTimers();
    const { surface, rerender, props } = renderPicker();
    const first = cellAt(0.3, 0.2);
    press(surface, pixelOf(first));
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight", shiftKey: true });
    const keyed = screen.getByLabelText("Colour code").textContent;
    expect(keyed).not.toBe(first.hex);
    act(() => {
      rerender(<ColorPicker {...props} color={first.hex} />);
    });
    expect(screen.getByLabelText("Colour code").textContent).toBe(keyed);
  });

  it("never pulls the handle back from a drag when an earlier answer arrives", () => {
    const { surface, rerender, props } = renderPicker();
    const first = cellAt(0.3, 0.2);
    const dragged = cellAt(0.4, 0.3);
    press(surface, pixelOf(first));
    dragTo(surface, pixelOf(cellAt(0.35, 0.25)), pixelOf(dragged), false);
    act(() => {
      rerender(<ColorPicker {...props} color={first.hex} />);
    });
    expect(screen.getByLabelText("Colour code").textContent).toBe(dragged.hex);
  });

  it("commits the colour a tap showed, not where a jittery finger lifted", () => {
    const { surface, onCommit } = renderPicker();
    const shown = cellAt(0.3, 0.2);
    const touch = { pointerId: 1, button: 0, pointerType: "touch" };
    fireEvent.pointerDown(surface, { ...touch, ...pixelOf(shown) });
    const lifted = { clientX: pixelOf(shown).clientX + 6, clientY: pixelOf(shown).clientY + 5 };
    expect(cellAt(lifted.clientX / RECT.width, lifted.clientY / RECT.height).hex).not.toBe(
      shown.hex,
    );
    fireEvent.pointerUp(surface, { ...touch, ...lifted });
    expect(onCommit.mock.calls).toEqual([[shown.hex]]);
  });

  it("sends a return to the old colour made while the first pick is still in flight", () => {
    const { surface, onCommit } = renderPicker();
    press(surface, pixelOf(cellAt(0.3, 0.2)));
    press(surface, pixelOf(BLUE_CELL));
    expect(onCommit.mock.calls).toEqual([[cellAt(0.3, 0.2).hex], [BLUE]]);
  });

  it("keeps focus where it is when the window is pressed (the handle takes it on release)", () => {
    renderPicker();
    const pressed = fireEvent.mouseDown(screen.getByTestId("color-picker-window"));
    expect(pressed).toBe(false);
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
    const { surface, rerender, props, onCommit } = renderPicker();
    const newcomer = cellAt(0.45, 0.4);
    // Inside Bors's zone while two players share the window, free once a third
    // joins (zones shrink as players arrive), and nowhere near the newcomer.
    const shrunk = windowCells().find((cell) => {
      const fromBors = deltaE(colorToOkLab(cell.hex)!, colorToOkLab(RED)!);
      const fromCyra = deltaE(colorToOkLab(cell.hex)!, colorToOkLab(newcomer.hex)!);
      return fromBors > ruleRadius(3) + 0.01 && fromBors < ruleRadius(2) - 0.01 && fromCyra > 0.2;
    })!;
    expect(shrunk).toBeTruthy();
    press(surface, pixelOf(shrunk));
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    expect(onCommit.mock.calls.at(-1)).not.toEqual([shrunk.hex]);
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
    press(surface, pixelOf(shrunk));
    expect(onCommit.mock.calls.at(-1)).toEqual([shrunk.hex]);
  });

  it("tells a screen reader an older colour's real lightness, not the band's edge", () => {
    // #0b0b41, OKLab L 0.20: darker than the window's band goes.
    renderPicker({ color: "hsl(240, 70%, 15%)" });
    const text = screen.getByRole("slider").getAttribute("aria-valuetext")!;
    expect(Number(/lightness (\d+)%/.exec(text)![1])).toBe(20);
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
    dragTo(surface, pixelOf(NEAR_RED_CELL), pixelOf(RED_CELL));
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    act(() => vi.advanceTimersByTime(NOTICE_HOLD_MS));
    expect(screen.queryByText(/Too close/)).toBeNull();
  });

  it("still sends the keys' colour when a press that never moved is cancelled", () => {
    vi.useFakeTimers();
    const { surface, onCommit } = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    const keyed = screen.getByLabelText("Colour code").textContent;
    fireEvent.pointerDown(screen.getByRole("slider"), {
      pointerId: 1,
      button: 0,
      clientX: 252,
      clientY: 60,
    });
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(screen.getByLabelText("Colour code").textContent).toBe(keyed);
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS));
    expect(onCommit.mock.calls).toEqual([[keyed]]);
  });

  it("stops showing a refused pick even when the handle was held while the answer came", () => {
    vi.useFakeTimers();
    const { surface, rerender, props } = renderPicker();
    press(surface, pixelOf(cellAt(0.3, 0.2)));
    fireEvent.pointerDown(screen.getByRole("slider"), {
      pointerId: 1,
      button: 0,
      ...pixelOf(BLUE_CELL),
    });
    act(() => {
      rerender(<ColorPicker {...props} color={BLUE} />); // the answer: nothing changed
    });
    act(() => vi.advanceTimersByTime(PENDING_TIMEOUT_MS + 200));
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, ...pixelOf(BLUE_CELL) });
    act(() => vi.advanceTimersByTime(PENDING_TIMEOUT_MS));
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
    const recoloured = cellAt(0.45, 0.4).hex;
    act(() => {
      rerender(<ColorPicker {...props} color={recoloured} />);
    });
    expect(screen.getByLabelText("Colour code").textContent).toBe(recoloured);
  });

  it("stops showing a refused pick after a drag back to it while it was in flight", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    const picked = cellAt(0.3, 0.2);
    press(surface, pixelOf(picked));
    dragTo(surface, pixelOf(cellAt(0.4, 0.3)), pixelOf(picked));
    act(() => vi.advanceTimersByTime(PENDING_TIMEOUT_MS * 3));
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
  });

  it("sends keys still waiting when a press off the handle is cancelled (a phone scroll)", () => {
    vi.useFakeTimers();
    const { surface, onCommit } = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    const keyed = screen.getByLabelText("Colour code").textContent;
    const touch = { pointerId: 1, button: 0, pointerType: "touch", ...pixelOf(cellAt(0.3, 0.2)) };
    fireEvent.pointerDown(surface, touch);
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(onCommit.mock.calls).toEqual([[keyed]]);
    expect(screen.getByLabelText("Colour code").textContent).toBe(keyed);
  });

  it("sends nothing while a press is down, even past the keys' quiet time", () => {
    vi.useFakeTimers();
    const { surface, onCommit } = renderPicker();
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, ...pixelOf(cellAt(0.3, 0.2)) });
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS + 50));
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, ...pixelOf(cellAt(0.3, 0.2)) });
    expect(onCommit.mock.calls).toEqual([[cellAt(0.3, 0.2).hex]]);
  });

  it("sends nothing while a drag from the handle is under way, even past the keys' quiet time", () => {
    vi.useFakeTimers();
    const { surface, onCommit } = renderPicker();
    const handle = screen.getByRole("slider");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    fireEvent.pointerDown(handle, { pointerId: 2, button: 0, ...pixelOf(BLUE_CELL) });
    fireEvent.pointerMove(surface, { pointerId: 2, ...pixelOf(cellAt(0.6, 0.3)) });
    act(() => vi.advanceTimersByTime(KEY_COMMIT_MS + 50));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("keeps an in-flight pick showing through a tap on the handle and a second press on it", () => {
    const { surface } = renderPicker();
    const picked = cellAt(0.3, 0.2);
    press(surface, pixelOf(picked));
    fireEvent.pointerDown(screen.getByRole("slider"), {
      pointerId: 1,
      button: 0,
      ...pixelOf(picked),
    });
    fireEvent.pointerUp(surface, { pointerId: 1, button: 0, ...pixelOf(picked) });
    expect(screen.getByLabelText("Colour code").textContent).toBe(picked.hex);
    press(surface, pixelOf(picked));
    expect(screen.getByLabelText("Colour code").textContent).toBe(picked.hex);
  });

  it("keeps a tap's zone notice while the mouse passes over the zone", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    press(surface, pixelOf(NEAR_RED_CELL));
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: "mouse", ...pixelOf(RED_CELL) });
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
  });

  it("names a zone under the mouse right after a pick that was not bumped", () => {
    vi.useFakeTimers();
    const { surface } = renderPicker();
    press(surface, pixelOf(cellAt(0.3, 0.2)));
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerMove(surface, { pointerId: 1, pointerType: "mouse", ...pixelOf(RED_CELL) });
    expect(screen.getByText("Bors's colour")).toBeTruthy();
  });

  it("clears a key step's bump notice a few seconds later", () => {
    vi.useFakeTimers();
    // The first free cell right of Bors's colour: one step left is inside his zone.
    const edge = windowCells().find(
      (cell) =>
        cell.row === RED_CELL.row &&
        cell.column > RED_CELL.column &&
        deltaE(cell.lab, colorToOkLab(RED)!) >= ruleRadius(2),
    )!;
    renderPicker({ color: edge.hex });
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft" });
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    act(() => vi.advanceTimersByTime(NOTICE_HOLD_MS));
    expect(screen.queryByText(/Too close/)).toBeNull();
  });

  it("forgets a cancelled drag and its notice", () => {
    const { surface } = renderPicker();
    dragTo(surface, pixelOf(NEAR_RED_CELL), pixelOf(RED_CELL), false);
    expect(screen.getByText("Too close to Bors")).toBeTruthy();
    fireEvent.pointerCancel(surface, { pointerId: 1 });
    expect(screen.getByLabelText("Colour code").textContent).toBe(BLUE);
    expect(screen.queryByText(/Too close/)).toBeNull();
  });
});
