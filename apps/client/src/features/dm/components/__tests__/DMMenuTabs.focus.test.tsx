// A DM menu opened by "Table settings…" hands focus to its active tab (U10b, the
// owner's Q5 rule 3: an item that opens something else passes focus to THAT thing).
// A menu opened any other way (its launcher) keeps focus where the person put it.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DMMenuTabs } from "../DMMenuTabs";

afterEach(() => cleanup());

const noop = () => {};

it("exposes the active tab as pressed, and only that one", () => {
  render(<DMMenuTabs activeTab="table" onTabChange={noop} />);
  expect(screen.getByRole("button", { name: "Table", pressed: true })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(1);
});

it("focuses the active tab when it mounts already asked to", () => {
  render(<DMMenuTabs activeTab="table" onTabChange={noop} focusRequest={1} />);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Table" }));
});

it("does not take focus when nothing asked", () => {
  render(<DMMenuTabs activeTab="table" onTabChange={noop} />);
  expect(document.activeElement).toBe(document.body);
});

it("focuses the new active tab when a second request arrives while it is open", () => {
  const view = render(<DMMenuTabs activeTab="map" onTabChange={noop} focusRequest={0} />);
  expect(document.activeElement).toBe(document.body);
  view.rerender(<DMMenuTabs activeTab="table" onTabChange={noop} focusRequest={1} />);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Table" }));
});
