// Every swatch row is a NAMED group (U10b): a visible label names it, or, where a parent
// section already carries the heading (the brush deck), an explicit aria-label does. A
// role="group" with no name is announced as just "group".
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileSwatchRow } from "../MobileSwatchRow";
import { MobileFloorPicker } from "../MobileFloorPicker";

afterEach(() => cleanup());

const options = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
];

it("names the group by its visible label", () => {
  render(<MobileSwatchRow label="Theme" options={options} selected="a" onSelect={vi.fn()} />);
  expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
});

it("names the group by aria-label when there is no visible label", () => {
  render(<MobileSwatchRow ariaLabel="Brushes" options={options} selected="a" onSelect={vi.fn()} />);
  expect(screen.getByRole("group", { name: "Brushes" })).toBeInTheDocument();
});

it("the brush deck's swatch group is named for what it holds", () => {
  render(<MobileFloorPicker label="Paint" selected="stone-floor" onSelect={vi.fn()} />);
  const groups = screen.getAllByRole("group");
  expect(groups.length).toBeGreaterThan(0);
  for (const group of groups) {
    expect(group, "an unnamed group").toHaveAccessibleName(/\S/);
  }
  expect(screen.getByRole("group", { name: "Paint brushes" })).toBeInTheDocument();
});
