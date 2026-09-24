// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../map-edit/brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: vi.fn(),
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));
import { EDITORS, escape, installMemoryStorage, mountEditor } from "./localEditors.fixtures";

let restoreStorage: () => void;
beforeEach(() => {
  restoreStorage = installMemoryStorage();
});
afterEach(() => {
  cleanup();
  restoreStorage();
  vi.restoreAllMocks();
});

describe.each(EDITORS)("real %s local Escape", (kind) => {
  it("cancels only its editor and consumes the eligible Escape", () => {
    const editor = mountEditor(kind);
    const event = escape(editor.input);
    editor.expectCancelled();
    expect(event.defaultPrevented).toBe(true);
    expect(editor.bubble).not.toHaveBeenCalled();
    expect(editor.localClose).not.toHaveBeenCalled();
    expect(editor.foregroundClose).not.toHaveBeenCalled();
  });

  it("behind a foreground surface leaves its draft and the bubbling event untouched", () => {
    const editor = mountEditor(kind);
    editor.cover();
    escape(editor.input);
    editor.expectOpen();
    // The local React ancestor sees it before the window-level foreground owner.
    expect(editor.bubble.mock.calls).toEqual([[false]]);
    expect(editor.foregroundClose).toHaveBeenCalledTimes(1);
    expect(editor.localClose).not.toHaveBeenCalled();
  });

  it.each(["preprevented", "isComposing", "keyCode229", "tracked composition"] as const)(
    "%s Escape neither mutates nor stops local bubbling",
    (mode) => {
      const editor = mountEditor(kind);
      if (mode === "tracked composition") fireEvent.compositionStart(editor.input);
      const event = escape(
        editor.input,
        mode === "isComposing"
          ? { isComposing: true }
          : mode === "keyCode229"
            ? { keyCode: 229 }
            : {},
        mode === "preprevented",
      );
      editor.expectOpen();
      expect(editor.bubble.mock.calls).toEqual([[mode === "preprevented"]]);
      expect(event.defaultPrevented).toBe(mode === "preprevented");
      expect(editor.localClose).not.toHaveBeenCalled();
      expect(editor.foregroundClose).not.toHaveBeenCalled();
      if (mode === "tracked composition") fireEvent.compositionEnd(editor.input);
    },
  );
});

it("the real Atlas native map SELECT keeps first refusal while rename stays open", () => {
  const editor = mountEditor("atlas");
  const mapSelect = screen.getByLabelText("Map for Glade");
  const event = escape(mapSelect);
  editor.expectOpen();
  expect(event.defaultPrevented).toBe(false);
  expect(editor.bubble.mock.calls).toEqual([[false]]);
  expect(editor.localClose).not.toHaveBeenCalled();
});

it("an empty brush query has no local cancel action and bubbles Escape untouched", () => {
  const editor = mountEditor("brush");
  fireEvent.change(editor.input, { target: { value: "" } });
  const event = escape(editor.input);
  expect(editor.input.value).toBe("");
  expect(event.defaultPrevented).toBe(false);
  expect(editor.bubble.mock.calls).toEqual([[false]]);
  expect(editor.commit).not.toHaveBeenCalled();
});
