// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDismissalFocus, type DismissalFocus } from "../dismissalFocus";
import { createMobileWorldReturn, type WorldReturnHost } from "../mobileWorldReturn";
import { frameQueue, launcher, panel } from "./focusFixtures";

let focus: DismissalFocus;
let queue: ReturnType<typeof frameQueue>;
beforeEach(() => {
  queue = frameQueue();
  focus = createDismissalFocus();
});
afterEach(() => {
  focus.invalidate();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function hostFor(frame: HTMLElement) {
  const dock = launcher();
  const tools = document.createElement("section");
  const tile = launcher(tools);
  tile.dataset.focusReturn = "world";
  const host: WorldReturnHost = {
    canRestoreTools: () => true,
    showTools: vi.fn(() => {
      frame.remove();
      document.body.append(tools);
    }),
    closeRaw: vi.fn(() => {
      frame.remove();
      tools.remove();
    }),
    toolsRoot: () => (tools.isConnected ? tools : null),
    toolsDockButton: () => dock,
  };
  return { host, tools, tile, dock };
}

describe("phone World explicit return destination", () => {
  it("resolves the newly mounted semantic tile only inside the supplied Tools host", () => {
    const outside = launcher();
    outside.dataset.focusReturn = "world";
    const { frame } = panel();
    const { host, tile, dock } = hostFor(frame);
    const adapter = createMobileWorldReturn(() => host);
    focus.request({ frame, close: adapter.closeExplicitly, resolveTarget: adapter.resolveTarget });
    queue.flush();
    expect(host.showTools).toHaveBeenCalledTimes(1);
    expect(host.closeRaw).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(tile);
    expect(document.activeElement).not.toBe(outside);
    expect(document.activeElement).not.toBe(dock);
  });

  it("a tile that cannot mount falls back to the map and ordinary Tools dock", () => {
    const { frame } = panel();
    const { host, dock } = hostFor(frame);
    host.showTools = vi.fn(() => frame.remove());
    const adapter = createMobileWorldReturn(() => host);
    focus.request({ frame, close: adapter.closeExplicitly, resolveTarget: adapter.resolveTarget });
    queue.flush();
    expect(host.closeRaw).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(dock);
  });

  it("ineligible entry closes raw without ever opening Tools", () => {
    const { frame } = panel();
    const { host, dock } = hostFor(frame);
    host.canRestoreTools = () => false;
    const adapter = createMobileWorldReturn(() => host);
    focus.request({ frame, close: adapter.closeExplicitly, resolveTarget: adapter.resolveTarget });
    queue.flush();
    expect(host.showTools).not.toHaveBeenCalled();
    expect(host.closeRaw).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(dock);
  });

  it("raw role/mode/layout close invalidates a pending ticket and never reopens Tools", () => {
    const { frame } = panel();
    const { host, dock } = hostFor(frame);
    const adapter = createMobileWorldReturn(() => host);
    const returned = vi.spyOn(dock, "focus");
    focus.request({ frame, close: adapter.closeExplicitly, resolveTarget: adapter.resolveTarget });
    expect(host.showTools).toHaveBeenCalledTimes(1);
    adapter.closeWithoutReturn(focus);
    queue.flush();
    expect(host.showTools).toHaveBeenCalledTimes(1);
    expect(host.closeRaw).toHaveBeenCalledTimes(1);
    expect(returned).not.toHaveBeenCalled();
  });

  it("reads current eligibility at return time and never focuses a stale role-hidden tile", () => {
    const { frame } = panel();
    const { host, tile, dock } = hostFor(frame);
    const adapter = createMobileWorldReturn(() => host);
    const tileFocus = vi.spyOn(tile, "focus");
    focus.request({ frame, close: adapter.closeExplicitly, resolveTarget: adapter.resolveTarget });
    host.canRestoreTools = () => false;
    queue.flush();
    expect(host.closeRaw).toHaveBeenCalledTimes(1);
    expect(tileFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(dock);
  });
});
