// Typing-surface guard: Escape typed into a text field (chat box, brush-deck
// search, inspector input) belongs to that field — it must not tear down the
// active tool. Escape anywhere else still clears it.

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToolMode } from "../useToolMode";

function dispatchEscape(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

describe("useToolMode — Escape typing-surface guard", () => {
  it("keeps the active tool when Escape comes from a text field", () => {
    const { result } = renderHook(() => useToolMode());
    act(() => result.current.setActiveTool("map-edit"));
    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      dispatchEscape(input);
      expect(result.current.activeTool).toBe("map-edit");
    } finally {
      input.remove();
    }
  });

  it("still clears the active tool on Escape from outside a field", () => {
    const { result } = renderHook(() => useToolMode());
    act(() => result.current.setActiveTool("map-edit"));
    dispatchEscape(window);
    expect(result.current.activeTool).toBeNull();
  });
});
