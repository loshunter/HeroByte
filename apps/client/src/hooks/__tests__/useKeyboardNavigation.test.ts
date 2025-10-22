import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardNavigation } from "../useKeyboardNavigation";

describe("useKeyboardNavigation", () => {
  const createParams = () => ({
    selectedDrawingId: "drawing:1",
    selectMode: true,
    sendMessage: vi.fn(),
    handleSelectDrawing: vi.fn(),
    selectedObjectId: "token:1",
    onSelectObject: vi.fn(),
  });

  it("sends delete message for selected drawing in select mode", () => {
    const params = createParams();
    renderHook(() => useKeyboardNavigation(params));

    const event = new KeyboardEvent("keydown", { key: "Delete" });
    window.dispatchEvent(event);

    expect(params.sendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "drawing:1" });
    expect(params.handleSelectDrawing).toHaveBeenCalledWith(null);
  });

  it("does not delete when select mode is disabled", () => {
    const params = { ...createParams(), selectMode: false };
    renderHook(() => useKeyboardNavigation(params));

    const event = new KeyboardEvent("keydown", { key: "Delete" });
    window.dispatchEvent(event);

    expect(params.sendMessage).not.toHaveBeenCalled();
  });

  it("clears selected object on Escape", () => {
    const params = createParams();
    renderHook(() => useKeyboardNavigation(params));

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    window.dispatchEvent(event);

    expect(params.onSelectObject).toHaveBeenCalledWith(null);
  });

  it("ignores delete key when focus is inside an input element", () => {
    const params = createParams();
    renderHook(() => useKeyboardNavigation(params));

    const event = new KeyboardEvent("keydown", { key: "Delete" });
    Object.defineProperty(event, "target", {
      value: document.createElement("input"),
      configurable: true,
    });

    window.dispatchEvent(event);

    expect(params.sendMessage).not.toHaveBeenCalled();
  });

  it("removes listeners on unmount", () => {
    const params = createParams();
    const hook = renderHook(() => useKeyboardNavigation(params));
    hook.unmount();

    const event = new KeyboardEvent("keydown", { key: "Delete" });
    window.dispatchEvent(event);

    expect(params.sendMessage).not.toHaveBeenCalled();
  });
});
