import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStatusEffects } from "../useStatusEffects.js";
import type { ClientMessage } from "@shared";

describe("useStatusEffects - Characterization Tests", () => {
  it("should provide a setStatusEffects function", () => {
    const sendMessage = vi.fn<[ClientMessage], void>();
    const { result } = renderHook(() => useStatusEffects({ sendMessage }));

    expect(result.current).toHaveProperty("setStatusEffects");
    expect(typeof result.current.setStatusEffects).toBe("function");
  });

  it("should send set-status-effects message with correct payload", () => {
    const sendMessage = vi.fn<[ClientMessage], void>();
    const { result } = renderHook(() => useStatusEffects({ sendMessage }));

    const effects = ["poisoned", "stunned"];

    act(() => {
      result.current.setStatusEffects(effects);
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "set-status-effects",
      effects: ["poisoned", "stunned"],
    });
  });

  it("should handle empty effects array", () => {
    const sendMessage = vi.fn<[ClientMessage], void>();
    const { result } = renderHook(() => useStatusEffects({ sendMessage }));

    act(() => {
      result.current.setStatusEffects([]);
    });

    expect(sendMessage).toHaveBeenCalledWith({
      t: "set-status-effects",
      effects: [],
    });
  });

  it("should maintain callback stability when sendMessage is stable", () => {
    const sendMessage = vi.fn<[ClientMessage], void>();
    const { result, rerender } = renderHook(() =>
      useStatusEffects({ sendMessage }),
    );

    const firstCallback = result.current.setStatusEffects;
    rerender();
    const secondCallback = result.current.setStatusEffects;

    expect(firstCallback).toBe(secondCallback);
  });

  it("should update callback when sendMessage changes", () => {
    const sendMessage1 = vi.fn<[ClientMessage], void>();
    const { result, rerender } = renderHook(
      ({ sendMessage }: { sendMessage: (msg: ClientMessage) => void }) =>
        useStatusEffects({ sendMessage }),
      { initialProps: { sendMessage: sendMessage1 } },
    );

    const firstCallback = result.current.setStatusEffects;

    const sendMessage2 = vi.fn<[ClientMessage], void>();
    rerender({ sendMessage: sendMessage2 });

    const secondCallback = result.current.setStatusEffects;

    expect(firstCallback).not.toBe(secondCallback);

    act(() => {
      result.current.setStatusEffects(["burning"]);
    });

    expect(sendMessage1).not.toHaveBeenCalled();
    expect(sendMessage2).toHaveBeenCalledWith({
      t: "set-status-effects",
      effects: ["burning"],
    });
  });
});
