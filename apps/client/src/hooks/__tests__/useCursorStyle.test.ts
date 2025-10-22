import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useCursorStyle } from "../useCursorStyle";

const defaultFlags = {
  isPanning: false,
  pointerMode: false,
  measureMode: false,
  drawMode: false,
  selectMode: false,
};

describe("useCursorStyle", () => {
  it("should return grabbing when panning", () => {
    const { result } = renderHook(() =>
      useCursorStyle({
        ...defaultFlags,
        isPanning: true,
      }),
    );

    expect(result.current).toBe("grabbing");
  });

  it("should return none when pointer mode is active", () => {
    const { result } = renderHook(() =>
      useCursorStyle({
        ...defaultFlags,
        pointerMode: true,
      }),
    );

    expect(result.current).toBe("none");
  });

  it("should return crosshair when measure mode is active", () => {
    const { result } = renderHook(() =>
      useCursorStyle({
        ...defaultFlags,
        measureMode: true,
      }),
    );

    expect(result.current).toBe("crosshair");
  });

  it("should return crosshair when draw mode is active", () => {
    const { result } = renderHook(() =>
      useCursorStyle({
        ...defaultFlags,
        drawMode: true,
      }),
    );

    expect(result.current).toBe("crosshair");
  });

  it("should return default when select mode is active", () => {
    const { result } = renderHook(() =>
      useCursorStyle({
        ...defaultFlags,
        selectMode: true,
      }),
    );

    expect(result.current).toBe("default");
  });

  it("should return grab when no modes are active", () => {
    const { result } = renderHook(() => useCursorStyle(defaultFlags));

    expect(result.current).toBe("grab");
  });

  it("should honor priority order when multiple modes are active", () => {
    const { result } = renderHook(() =>
      useCursorStyle({
        ...defaultFlags,
        isPanning: true,
        pointerMode: true,
        measureMode: true,
        drawMode: true,
        selectMode: true,
      }),
    );

    expect(result.current).toBe("grabbing");
  });
});
