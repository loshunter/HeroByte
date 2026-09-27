import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MapEditBrushDeck } from "../MapEditBrushDeck";
import { MobileFloorPicker } from "../mobile/MobileFloorPicker";

vi.mock("../brushThumbnails", () => ({
  peekBrushThumbnail: () => null,
  requestBrushThumbnails: () => {},
  getBrushThumbnailVersion: () => 0,
  subscribeBrushThumbnails: () => () => {},
}));
afterEach(cleanup);

describe("material collection grammar", () => {
  it("desktop shows names without hover and filters categories without replacing the armed material", () => {
    const onSelect = vi.fn();
    render(<MapEditBrushDeck selected="grass" onSelect={onSelect} />);
    expect(screen.getByTitle("Oak Floor")).toHaveTextContent("Oak Floor");
    fireEvent.change(screen.getByRole("combobox", { name: "Material category" }), {
      target: { value: "wood" },
    });
    expect(screen.queryByTitle("Grass")).toBeNull();
    expect(screen.getByTitle("Oak Floor")).toBeVisible();
    expect(screen.getByRole("group", { name: "Selected material" })).toHaveTextContent("Grass");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("phone searches across material shelves and keeps the selected preview and pin target", () => {
    const onSelect = vi.fn();
    render(<MobileFloorPicker label="Material" selected="grass" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search brushes" }), {
      target: { value: "oak" },
    });
    expect(screen.getByRole("button", { name: "Oak Floor" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Grass" })).toBeNull();
    expect(
      within(screen.getByRole("group", { name: "Selected material" })).getByText("Grass"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Pin Grass/ })).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
