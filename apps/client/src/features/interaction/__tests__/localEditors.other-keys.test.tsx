// @vitest-environment jsdom
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../map-edit/brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));
import { EDITORS, installMemoryStorage, mountEditor } from "./localEditors.fixtures";

let restoreStorage: () => void;
beforeEach(() => {
  restoreStorage = installMemoryStorage();
});
afterEach(() => {
  cleanup();
  restoreStorage();
  vi.restoreAllMocks();
});

describe.each(EDITORS)("real %s non-Escape controls", (kind) => {
  it("preserves Enter's existing commit or search behavior", () => {
    const editor = mountEditor(kind);
    fireEvent.keyDown(editor.input, { key: "Enter" });
    editor.expectCommitted();
    expect(editor.localClose).not.toHaveBeenCalled();
  });
});

it.each(["die", "modifier"] as const)("%s still commits on blur", (kind) => {
  const editor = mountEditor(kind);
  fireEvent.blur(editor.input);
  editor.expectCommitted();
});

it.each([{ key: "Backspace" }, { key: "z", ctrlKey: true }, { key: "z", metaKey: true }])(
  "brush search retains propagation containment for $key",
  (options) => {
    const editor = mountEditor("brush");
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...options });
    fireEvent(editor.input, event);
    editor.expectOpen();
    expect(editor.bubble).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  },
);
