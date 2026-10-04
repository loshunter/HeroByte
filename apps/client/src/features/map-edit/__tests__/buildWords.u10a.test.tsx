// U10a — the desktop and the phone name Build's Populate and Rope / curve controls
// the same way, in the words the tool list uses (not raw ids, not "Structs").
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { mapStudioTileCategoryLabel } from "../../map-studio/starterTiles";
import type { MapEditToolbarProps } from "../mapEditTypes";
import { MapEditPopulatePanel } from "../MapEditPopulatePanel";
import { MapEditToolPanels } from "../MapEditToolPanels";
import { MobilePopulateBlock } from "../mobile/MobilePopulateBlock";
import { MobileMapEditToolPanels } from "../mobile/MobileMapEditToolPanels";

afterEach(() => cleanup());

const populateBag = {
  populateTarget: { kind: "room" },
  populateHint: "A room is ready.",
  canPopulate: true,
  populateCategory: "objects",
  populateDensity: "medium",
  onSelectPopulateCategory: vi.fn(),
  onSelectPopulateDensity: vi.fn(),
  onPopulate: vi.fn(),
} as unknown as MapEditToolbarProps;

const CATEGORY_NAMES = ["Objects", "Structures", "Terrain", "Decals"];
const DENSITY_NAMES = ["Low", "Medium", "High"];

const namesOf = (names: string[]) =>
  names.map((name) => screen.queryByRole("button", { name }) !== null);

describe("Populate's chips", () => {
  it.each([
    ["desktop", <MapEditPopulatePanel key="d" {...populateBag} />],
    ["phone", <MobilePopulateBlock key="m" {...populateBag} />],
  ])("name the categories and densities in words on the %s", (_layout, ui) => {
    render(ui);
    expect(namesOf(CATEGORY_NAMES)).toEqual([true, true, true, true]);
    expect(namesOf(DENSITY_NAMES)).toEqual([true, true, true]);
    for (const raw of ["structures", "decals", "low", "medium", "Structs", "Med", "Wear"]) {
      expect(screen.queryByRole("button", { name: raw })).toBeNull();
    }
  });
});

describe("Populate's chips: structure, state and the phone's width", () => {
  it("the phone's category row asks for chips wide enough for 'Structures'; the density row does not", () => {
    render(<MobilePopulateBlock {...populateBag} />);
    expect(screen.getByRole("button", { name: "Structures" }).parentElement).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
    });
    expect(
      screen.getByRole("button", { name: "Medium" }).parentElement?.style.gridTemplateColumns,
    ).toBe("");
  });

  it("each phone row is a named group of its own, so 'From' and 'How much' are not confused", () => {
    render(<MobilePopulateBlock {...populateBag} />);
    const from = screen.getByRole("group", { name: "From" });
    const howMuch = screen.getByRole("group", { name: "How much" });
    expect(from).not.toBe(howMuch);
    expect(within(from).getByRole("button", { name: "Structures" })).toBeInTheDocument();
    expect(within(howMuch).getByRole("button", { name: "Medium" })).toBeInTheDocument();
    expect(within(howMuch).queryByRole("button", { name: "Structures" })).toBeNull();
  });

  it("the desktop panel marks the chosen chips and reports a click once, by id", () => {
    const onCategory = vi.fn();
    render(
      <MapEditPopulatePanel
        {...({
          ...populateBag,
          onSelectPopulateCategory: onCategory,
        } as unknown as MapEditToolbarProps)}
      />,
    );
    const pressed = (name: string) =>
      screen.getByRole("button", { name }).getAttribute("aria-pressed");
    expect(pressed("Objects")).toBe("true");
    expect(pressed("Structures")).toBe("false");
    expect(pressed("Medium")).toBe("true");
    expect(pressed("Low")).toBe("false");
    expect(screen.getByRole("group", { name: "Decorate from" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "How much" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Structures" }));
    expect(onCategory).toHaveBeenCalledTimes(1);
    expect(onCategory).toHaveBeenCalledWith("structures");
  });
});

describe("the Rope / curve style row", () => {
  const splineBag = {
    activeSubTool: "spline",
    splineKind: "rope",
    onSelectSplineKind: vi.fn(),
  } as unknown as MapEditToolbarProps;

  it.each([
    ["desktop", <MapEditToolPanels key="d" {...splineBag} />],
    ["phone", <MobileMapEditToolPanels key="m" {...splineBag} />],
  ])("is labelled by the tool's own name on the %s", (_layout, ui) => {
    render(ui);
    expect(screen.getByText("Rope / curve style")).toBeInTheDocument();
    expect(screen.queryByText(/^Curve/)).toBeNull();
    for (const kind of ["Rope", "Chain", "Ribbon", "Filigree"]) {
      expect(screen.getByRole("button", { name: kind })).toBeInTheDocument();
    }
  });

  it("marks the chosen kind as pressed on the desktop, where it was only a colour", () => {
    render(<MapEditToolPanels {...splineBag} />);
    expect(screen.getByRole("button", { name: "Rope" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Chain" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: "Rope / curve style" })).toBeInTheDocument();
  });
});

describe("the uploads shelf", () => {
  it("the starter-tile category label for the uploads shelf reads My uploads", () => {
    expect(mapStudioTileCategoryLabel("my-stuff")).toBe("My uploads");
  });
});
