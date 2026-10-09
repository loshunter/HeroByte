import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LazyColorPicker } from "../LazyColorPicker";
import type { ColorPickerControl } from "../colorPickerControl";

const control: ColorPickerControl = {
  color: "#7fa0ff",
  holders: [],
  dmUids: [],
  ownerUid: "me",
  characterId: "mine",
  name: "Mine",
  exempt: false,
  onCommit: vi.fn(),
};

describe("LazyColorPicker", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  });
  afterEach(() => vi.restoreAllMocks());

  it("loads the picker on demand", async () => {
    render(<LazyColorPicker {...control} />);
    expect(await screen.findByRole("slider", { name: "Mine's colour" })).toBeTruthy();
  });
});
