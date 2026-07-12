import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  clampDevicePixelRatio,
  MAX_DEVICE_PIXEL_RATIO,
  useDevicePixelRatio,
} from "../useDevicePixelRatio";

describe("clampDevicePixelRatio", () => {
  it("clamps into [1, MAX] and defends against bad values", () => {
    expect(clampDevicePixelRatio(0.5)).toBe(1);
    expect(clampDevicePixelRatio(1)).toBe(1);
    expect(clampDevicePixelRatio(2)).toBe(2);
    expect(clampDevicePixelRatio(4)).toBe(MAX_DEVICE_PIXEL_RATIO);
    expect(clampDevicePixelRatio(0)).toBe(1);
    expect(clampDevicePixelRatio(Number.NaN)).toBe(1);
  });
});

describe("useDevicePixelRatio", () => {
  const changeListeners: Array<() => void> = [];

  function setDpr(value: number) {
    Object.defineProperty(window, "devicePixelRatio", { value, configurable: true });
  }

  function mockMatchMedia() {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      addEventListener: (_: string, cb: () => void) => changeListeners.push(cb),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  afterEach(() => {
    changeListeners.length = 0;
    vi.restoreAllMocks();
  });

  it("returns the clamped current device pixel ratio", () => {
    setDpr(2);
    mockMatchMedia();
    const { result } = renderHook(() => useDevicePixelRatio());
    expect(result.current).toBe(2);
  });

  it("caps a 4× phone at the memory limit (3)", () => {
    setDpr(4);
    mockMatchMedia();
    const { result } = renderHook(() => useDevicePixelRatio());
    expect(result.current).toBe(MAX_DEVICE_PIXEL_RATIO);
  });

  it("updates when the ratio changes (window moved between monitors)", () => {
    setDpr(1);
    mockMatchMedia();
    const { result } = renderHook(() => useDevicePixelRatio());
    expect(result.current).toBe(1);

    act(() => {
      setDpr(2);
      changeListeners.forEach((cb) => cb());
    });
    expect(result.current).toBe(2);
  });
});
