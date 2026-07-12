import { render, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useElementSize } from "../useElementSize";

let roCallback: ResizeObserverCallback | null = null;

// A probe that surfaces the hook's reported size to the test.
function Probe({ onSize }: { onSize: (s: { w: number; h: number }) => void }) {
  const { ref, w, h } = useElementSize<HTMLDivElement>();
  onSize({ w, h });
  return React.createElement("div", { ref });
}

function mockRect(width: number, height: number) {
  return vi
    .spyOn(HTMLDivElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ width, height } as DOMRect);
}

describe("useElementSize", () => {
  beforeEach(() => {
    roCallback = null;
    global.ResizeObserver = vi.fn().mockImplementation((cb: ResizeObserverCallback) => {
      roCallback = cb;
      return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
    });
    // Run rAF synchronously so the resize fallback settles within the test.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("reports the element's real measured rect on mount (no magic default)", () => {
    mockRect(1024, 768);
    const sizes: { w: number; h: number }[] = [];
    render(React.createElement(Probe, { onSize: (s) => sizes.push(s) }));
    expect(sizes.at(-1)).toEqual({ w: 1024, h: 768 });
  });

  it("updates when the ResizeObserver reports a new content rect", () => {
    mockRect(100, 100);
    const sizes: { w: number; h: number }[] = [];
    render(React.createElement(Probe, { onSize: (s) => sizes.push(s) }));
    act(() => {
      roCallback?.(
        [{ contentRect: { width: 500, height: 400 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(sizes.at(-1)).toEqual({ w: 500, h: 400 });
  });

  it("re-reads the rect on orientationchange (rotate to landscape)", () => {
    const rect = mockRect(375, 812);
    const sizes: { w: number; h: number }[] = [];
    render(React.createElement(Probe, { onSize: (s) => sizes.push(s) }));
    rect.mockReturnValue({ width: 812, height: 375 } as DOMRect);
    act(() => window.dispatchEvent(new Event("orientationchange")));
    expect(sizes.at(-1)).toEqual({ w: 812, h: 375 });
  });

  it("ignores a 0×0 mount read until the observer delivers a real size", () => {
    mockRect(0, 0);
    const sizes: { w: number; h: number }[] = [];
    render(React.createElement(Probe, { onSize: (s) => sizes.push(s) }));
    expect(sizes.at(-1)).toEqual({ w: 0, h: 0 }); // stays initial, no crash
    act(() => {
      roCallback?.(
        [{ contentRect: { width: 640, height: 480 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(sizes.at(-1)).toEqual({ w: 640, h: 480 });
  });
});
