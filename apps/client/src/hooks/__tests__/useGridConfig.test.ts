import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useGridConfig } from "../useGridConfig";

describe("useGridConfig", () => {
  it("should return the default grid configuration for the provided grid size", () => {
    const { result } = renderHook(() => useGridConfig(50));

    expect(result.current).toEqual({
      show: true,
      size: 50,
      color: "#447DF7",
      majorEvery: 5,
      opacity: 0.15,
    });
  });

  it("should sync the grid size when the gridSize prop changes", () => {
    const { result, rerender } = renderHook(({ gridSize }) => useGridConfig(gridSize), {
      initialProps: { gridSize: 25 },
    });

    expect(result.current.size).toBe(25);

    rerender({ gridSize: 40 });

    expect(result.current.size).toBe(40);
  });

  it("should preserve static grid properties when the grid size changes", () => {
    const { result, rerender } = renderHook(({ gridSize }) => useGridConfig(gridSize), {
      initialProps: { gridSize: 10 },
    });

    rerender({ gridSize: 32 });

    expect(result.current.color).toBe("#447DF7");
    expect(result.current.majorEvery).toBe(5);
    expect(result.current.opacity).toBe(0.15);
    expect(result.current.show).toBe(true);
  });

  it("should handle a zero grid size value", () => {
    const { result } = renderHook(() => useGridConfig(0));

    expect(result.current.size).toBe(0);
  });
});
