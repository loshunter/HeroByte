// The desktop Decorate panel's two choice rows carry a VISIBLE label (U10b), the one the
// phone's rows already have, and their group names come from it (not from a hidden
// aria-label that sighted people never see).
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MapEditPopulatePanel } from "../MapEditPopulatePanel";
import type { MapEditToolbarProps } from "../mapEditTypes";

afterEach(() => cleanup());

const props = {
  populateHint: "You just drew a room.",
  populateTarget: { kind: "room" },
  populateCategory: "objects",
  populateDensity: "medium",
  onSelectPopulateCategory: vi.fn(),
  onSelectPopulateDensity: vi.fn(),
  onPopulate: vi.fn(),
  canPopulate: true,
} as unknown as MapEditToolbarProps;

it("prints 'Decorate from' and 'How much' and names each group by them", () => {
  render(<MapEditPopulatePanel {...props} />);
  expect(screen.getByText("Decorate from")).toBeVisible();
  expect(screen.getByText("How much")).toBeVisible();
  const from = screen.getByRole("group", { name: "Decorate from" });
  const howMuch = screen.getByRole("group", { name: "How much" });
  expect(from.getAttribute("aria-labelledby")).toBeTruthy();
  expect(from).not.toHaveAttribute("aria-label");
  expect(howMuch.getAttribute("aria-labelledby")).toBeTruthy();
  expect(howMuch).not.toHaveAttribute("aria-label");
});

it("prints no labels while there is nothing to decorate", () => {
  render(
    <MapEditPopulatePanel
      {...({ ...props, populateTarget: null } as unknown as MapEditToolbarProps)}
    />,
  );
  expect(screen.queryByText("Decorate from")).toBeNull();
  expect(screen.queryByText("How much")).toBeNull();
});
