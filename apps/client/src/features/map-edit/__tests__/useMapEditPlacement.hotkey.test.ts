// The bare `r` rotates the pending stamp — from the map, never from a field
// the DM is typing into (the isEditableTarget rule every window-level
// single-key shortcut obeys).

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMapEditPlacement } from "../useMapEditPlacement";

function mount(active = true) {
  const onRotateStamp = vi.fn();
  renderHook(() =>
    useMapEditPlacement({
      active,
      subTool: "place",
      document: null,
      selectedAssetId: "",
      saving: false,
      stampMode: true,
      stampRotation: 0,
      onRotateStamp,
      addTile: vi.fn(),
      addStamp: vi.fn(),
      addStamps: vi.fn(),
    }),
  );
  return onRotateStamp;
}

function pressR(target: EventTarget = window, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "r", bubbles: true, ...init }));
}

describe("useMapEditPlacement — the R hotkey", () => {
  it("rotates the stamp from the map, Shift reverses, Ctrl/Cmd stays the browser's", () => {
    const onRotateStamp = mount();
    pressR();
    expect(onRotateStamp).toHaveBeenCalledWith(1);
    pressR(window, { shiftKey: true, key: "R" });
    expect(onRotateStamp).toHaveBeenLastCalledWith(-1);
    pressR(window, { ctrlKey: true });
    expect(onRotateStamp).toHaveBeenCalledTimes(2);
  });

  it("never rotates from a typing surface — an 'r' typed into a field is text", () => {
    const onRotateStamp = mount();
    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      pressR(input);
      expect(onRotateStamp).not.toHaveBeenCalled();
    } finally {
      input.remove();
    }
  });

  it("does nothing while the placement tools are not active", () => {
    const onRotateStamp = mount(false);
    pressR();
    expect(onRotateStamp).not.toHaveBeenCalled();
  });
});
