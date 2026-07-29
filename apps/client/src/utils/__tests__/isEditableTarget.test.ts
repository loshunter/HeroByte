import { describe, expect, it } from "vitest";
import { isEditableTarget } from "../isEditableTarget";

describe("isEditableTarget", () => {
  it("treats text inputs, textareas and selects as typing surfaces", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag)), tag).toBe(true);
    }
  });

  it("treats contentEditable elements as typing surfaces", () => {
    const div = document.createElement("div");
    // jsdom never flips isContentEditable, so pin the property directly —
    // the branch under test is ours, not jsdom's.
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isEditableTarget(div)).toBe(true);
  });

  it("rejects buttons, plain elements, window and null", () => {
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
