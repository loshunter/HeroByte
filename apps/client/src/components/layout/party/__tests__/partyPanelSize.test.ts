// The Party panel tells the map it changed height with its own named event,
// never a window `resize`: every resize cancels an in-flight map gesture and a
// pending focus return (useToolContextTransitions). The shared test setup's
// ResizeObserver never calls back, so this drives the real callback itself.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PARTY_PANEL_RESIZED, announcePartyPanelSize } from "../partyPanelSize";

let callback: ResizeObserverCallback | null = null;
let observed: Element[] = [];
let disconnected = false;

class CapturingResizeObserver {
  constructor(onResize: ResizeObserverCallback) {
    callback = onResize;
  }
  observe(node: Element) {
    observed.push(node);
  }
  unobserve() {}
  disconnect() {
    disconnected = true;
  }
}

beforeEach(() => {
  callback = null;
  observed = [];
  disconnected = false;
  vi.stubGlobal("ResizeObserver", CapturingResizeObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe("announcePartyPanelSize", () => {
  it("announces a height change as its own event, never as a window resize", () => {
    const panel = document.createElement("div");
    const named = vi.fn();
    const resized = vi.fn();
    window.addEventListener(PARTY_PANEL_RESIZED, named);
    window.addEventListener("resize", resized);

    const stop = announcePartyPanelSize(panel);
    expect(observed).toEqual([panel]);
    callback?.([], {} as ResizeObserver);

    expect(named).toHaveBeenCalledTimes(1);
    expect(resized).not.toHaveBeenCalled();

    stop();
    expect(disconnected).toBe(true);
    window.removeEventListener(PARTY_PANEL_RESIZED, named);
    window.removeEventListener("resize", resized);
  });
});
