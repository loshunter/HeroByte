import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KickLayoutHarness } from "./kickLifetime.fixtures";
import { kickCalls, escape } from "./popoverOwners.fixtures";
import { viewport } from "./frameInteraction.fixtures";

// Canvas rendering and the lazy DM feature body are outside this lifetime test.
// The phone shell, its DM launch button, machine, screen, and Kick form stay real.
vi.mock("../../../ui/MapBoard", () => ({ default: () => <div data-testid="map-board" /> }));
vi.mock("../../dm/lazy-entry", () => ({ DMMenuContainer: () => <div>DM feature body</div> }));
let previous: [number, number];
beforeEach(() => {
  previous = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
});
afterEach(() => {
  cleanup();
  viewport(...previous);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function draft() {
  for (const [name, value] of Object.entries({
    Name: "Crossing draft",
    Theme: "wood",
    Density: "high",
    Size: "large",
    Seed: "4242",
    "Door type": "stair",
  }))
    fireEvent.change(screen.getByLabelText(name), { target: { value } });
}
function expectDraft() {
  for (const [name, value] of Object.entries({
    Name: "Crossing draft",
    Theme: "wood",
    Density: "high",
    Size: "large",
    Seed: "4242",
    "Door type": "stair",
  }))
    expect(screen.getByLabelText(name)).toHaveValue(value);
}
function phoneOpen() {
  fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: /^DM$/i }));
  fireEvent.click(screen.getByRole("button", { name: "🚪 Kick in a door" }));
}
function onlyKickSurface() {
  expect(
    Array.from(document.querySelectorAll("[data-mobile-surface]"), (node) =>
      node.getAttribute("data-mobile-surface"),
    ),
  ).toEqual(["kick"]);
}

describe("Kick lifetime across actual layout replacement", () => {
  it.each([true, false])(
    "preserves every unsent field crossing from mobile=%s and back",
    (mobile) => {
      const calls = kickCalls();
      const view = render(<KickLayoutHarness mobile={mobile} calls={calls} />);
      if (mobile) phoneOpen();
      else fireEvent.click(screen.getByRole("button", { name: "Open kick" }));
      draft();
      view.rerender(<KickLayoutHarness mobile={!mobile} calls={calls} />);
      expectDraft();
      if (!mobile) onlyKickSurface();
      view.rerender(<KickLayoutHarness mobile={mobile} calls={calls} />);
      expectDraft();
      if (mobile) onlyKickSurface();
      expect(calls.send).not.toHaveBeenCalled();
    },
  );

  it("G on a mobile hardware keyboard opens a visible shared session", () => {
    const calls = kickCalls();
    const view = render(<KickLayoutHarness mobile calls={calls} />);
    fireEvent.keyDown(document.body, { key: "g" });
    onlyKickSurface();
    draft();
    view.rerender(<KickLayoutHarness mobile={false} calls={calls} />);
    expectDraft();
    expect(calls.send).not.toHaveBeenCalled();
  });

  it.each(["cancel", "frame", "escape", "party", "mode"])(
    "%s after a desktop-to-phone crossing clears shared open state with no resurrection",
    (route) => {
      const calls = kickCalls();
      const view = render(<KickLayoutHarness mobile={false} calls={calls} />);
      fireEvent.click(screen.getByRole("button", { name: "Open kick" }));
      draft();
      view.rerender(<KickLayoutHarness mobile calls={calls} />);
      onlyKickSurface();
      if (route === "cancel") fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
      else if (route === "frame")
        fireEvent.click(screen.getByRole("button", { name: "Close Kick in a door" }));
      else if (route === "escape") escape(screen.getByLabelText("Name"));
      else if (route === "party")
        fireEvent.click(
          within(screen.getByRole("navigation")).getByRole("button", { name: /^Party$/i }),
        );
      else view.rerender(<KickLayoutHarness mobile calls={calls} tool="map-edit" />);
      expect(screen.queryByTestId("kick-panel")).toBeNull();
      view.rerender(<KickLayoutHarness mobile={false} calls={calls} />);
      expect(screen.queryByTestId("kick-panel")).toBeNull();
      expect(calls.send).not.toHaveBeenCalled();
    },
  );

  it("a phone ROLL after crossing sends once and never resurrects the panel", () => {
    const calls = kickCalls();
    const view = render(<KickLayoutHarness mobile={false} calls={calls} />);
    fireEvent.click(screen.getByRole("button", { name: "Open kick" }));
    draft();
    view.rerender(<KickLayoutHarness mobile calls={calls} />);
    onlyKickSurface();
    fireEvent.submit(screen.getByTestId("kick-panel"));
    expect(calls.send).toHaveBeenCalledTimes(1);
    expect(calls.send).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "atlas-kick",
        name: "Crossing draft",
        seed: 4242,
        linkType: "stair",
        recipe: { recipeId: "dungeon", theme: "wood", density: "high", size: "large" },
      }),
    );
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    view.rerender(<KickLayoutHarness mobile={false} calls={calls} />);
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    expect(calls.send).toHaveBeenCalledTimes(1);
  });

  it("null snapshot preserves the draft through a hidden phone screen; confirmed demotion discards it", () => {
    const calls = kickCalls();
    const view = render(<KickLayoutHarness mobile calls={calls} />);
    phoneOpen();
    draft();
    view.rerender(<KickLayoutHarness mobile calls={calls} isDM={false} snapshot={null} />);
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    view.rerender(<KickLayoutHarness mobile calls={calls} />);
    expectDraft();
    view.rerender(<KickLayoutHarness mobile calls={calls} isDM={false} />);
    view.rerender(<KickLayoutHarness mobile={false} calls={calls} />);
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    expect(calls.send).not.toHaveBeenCalled();
  });
});
