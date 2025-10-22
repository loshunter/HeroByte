import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMapActions } from "../useMapActions.js";
import type { ClientMessage } from "@shared";

describe("useMapActions - Characterization", () => {
  it("should provide setMapBackground function that sends map-background message", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useMapActions({ sendMessage }));

    act(() => {
      result.current.setMapBackground("https://example.com/map.png");
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "map-background",
      data: "https://example.com/map.png",
    } as ClientMessage);
  });

  it("should provide setGridSize function that sends grid-size message", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useMapActions({ sendMessage }));

    act(() => {
      result.current.setGridSize(100);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "grid-size",
      size: 100,
    } as ClientMessage);
  });

  it("should provide setGridSquareSize function that sends grid-square-size message", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useMapActions({ sendMessage }));

    act(() => {
      result.current.setGridSquareSize(10);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "grid-square-size",
      size: 10,
    } as ClientMessage);
  });

  it("should maintain callback stability across re-renders", () => {
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(() => useMapActions({ sendMessage }));

    const initialSetMapBackground = result.current.setMapBackground;
    const initialSetGridSize = result.current.setGridSize;
    const initialSetGridSquareSize = result.current.setGridSquareSize;

    // Trigger re-render
    rerender();

    // Callbacks should remain stable
    expect(result.current.setMapBackground).toBe(initialSetMapBackground);
    expect(result.current.setGridSize).toBe(initialSetGridSize);
    expect(result.current.setGridSquareSize).toBe(initialSetGridSquareSize);
  });

  it("should handle multiple consecutive calls correctly", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useMapActions({ sendMessage }));

    act(() => {
      result.current.setMapBackground("url1");
      result.current.setGridSize(50);
      result.current.setGridSquareSize(5);
    });

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      t: "map-background",
      data: "url1",
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      t: "grid-size",
      size: 50,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(3, {
      t: "grid-square-size",
      size: 5,
    });
  });

  it("should handle empty string for map background", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useMapActions({ sendMessage }));

    act(() => {
      result.current.setMapBackground("");
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "map-background",
      data: "",
    });
  });

  it("should handle edge case numeric values for grid settings", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useMapActions({ sendMessage }));

    act(() => {
      result.current.setGridSize(0);
      result.current.setGridSquareSize(1);
    });

    expect(sendMessage).toHaveBeenNthCalledWith(1, {
      t: "grid-size",
      size: 0,
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      t: "grid-square-size",
      size: 1,
    });
  });
});
