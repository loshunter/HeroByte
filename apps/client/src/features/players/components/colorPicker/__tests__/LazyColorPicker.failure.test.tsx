import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LazyColorPicker } from "../LazyColorPicker";

// A deploy renamed the chunk while the tab was open: the import rejects.
vi.mock("../ColorPicker", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

describe("LazyColorPicker when its chunk cannot load", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the failure in the picker's space and says how to recover", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <LazyColorPicker
        color="#7fa0ff"
        holders={[]}
        dmUids={[]}
        ownerUid="me"
        characterId="mine"
        name="Mine"
        exempt={false}
        onCommit={vi.fn()}
      />,
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/Reload the page/);
  });
});
