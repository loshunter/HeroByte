/**
 * The phone's tool dials.
 *
 * Three things here are load-bearing rather than cosmetic:
 *   - every dial reaches the SAME bag callback the desktop palette uses, with
 *     the same value, because a dial wired to nothing looks identical to a dial
 *     wired to something until a DM drags with it;
 *   - PANEL_TOOLS and the panels are one list, since the sheet's open/close
 *     rule keys off PANEL_TOOLS — two lists could disagree and leave a tool
 *     holding the sheet open over nothing;
 *   - nothing here is lazy, asserted SYNCHRONOUSLY. React caches a lazy
 *     payload's rejection forever, and this mode is the worst place in the app
 *     to be trapped behind a chunk that will not load.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileMapEditToolPanels, PANEL_TOOLS } from "../MobileMapEditToolPanels";
import { isDragTool } from "../../mapEditToolKinds";
import type { MapEditToolbarProps } from "../../mapEditTypes";

afterEach(() => cleanup());

const bag = (overrides: Record<string, unknown> = {}) =>
  ({
    isLive: true,
    busy: false,
    activeSubTool: "room",
    onSelectSubTool: vi.fn(),
    floorFamily: "grass",
    onSelectFloorFamily: vi.fn(),
    roomWallFamily: "none",
    onSelectRoomWallFamily: vi.fn(),
    hallwayWidth: 1,
    onSelectHallwayWidth: vi.fn(),
    splineKind: "rope",
    onSelectSplineKind: vi.fn(),
    selectedAssetId: "objects:crate",
    onSelectAsset: vi.fn(),
    // Generate joined PANEL_TOOLS in the commit that added its panel, and the
    // coverage test below immediately rendered it with none of these — which
    // is the coverage test doing exactly its job.
    generateParams: { theme: "stone", density: "medium", seed: 7 },
    onGenerateParamsChange: vi.fn(),
    onRerollSeed: vi.fn(),
    onGenerate: vi.fn(),
    canGenerate: true,
    generateRegion: { cols: 24, rows: 30 },
    generateHint: null,
    ...overrides,
  }) as unknown as MapEditToolbarProps;

/** Find a panel by its HEADING, matched exactly. A regex would not do: one of
 * the bundled families is called "Cavern Floor", so /Floor/i hits the "Floor"
 * heading and a swatch inside it. */
const section = (heading: string): HTMLElement => {
  const label = [...document.querySelectorAll<HTMLElement>(".mobile-tool-sheet__label")].find(
    (el) => el.textContent === heading,
  );
  if (!label) throw new Error(`no panel headed "${heading}"`);
  return label.closest(".mobile-tool-sheet__section") as HTMLElement;
};

describe("the phone's tool dials", () => {
  it("wires every dial to its own bag callback, with its own value", () => {
    // Hallway carries the most dials of any tool, so one render covers width,
    // the wall ring and the floor picker together.
    const hall = bag({ activeSubTool: "hallway" });
    const { unmount } = render(<MobileMapEditToolPanels {...hall} />);

    fireEvent.click(within(section("Width (cells)")).getByRole("button", { name: "3" }));
    expect(hall.onSelectHallwayWidth).toHaveBeenCalledWith(3);

    fireEvent.click(within(section("Side walls")).getByRole("button", { name: /None/i }));
    expect(hall.onSelectRoomWallFamily).toHaveBeenCalledWith("none");

    // The floor picker shelves: pick a shelf, then a family inside it. The
    // families live in the nested grid; the shelves are the sibling chip row,
    // so this reaches a family by STRUCTURE rather than by excluding shelf
    // names — a family called "Sandstone" would defeat a name filter.
    fireEvent.click(within(section("Floor")).getByRole("button", { name: "Ground" }));
    const families = section("Floor").querySelector(".mobile-tool-sheet__grid")!;
    fireEvent.click(within(families as HTMLElement).getAllByRole("button")[0]!);
    expect(hall.onSelectFloorFamily).toHaveBeenCalled();
    unmount();

    const spline = bag({ activeSubTool: "spline" });
    render(<MobileMapEditToolPanels {...spline} />);
    fireEvent.click(screen.getByRole("button", { name: /Chain/i }));
    expect(spline.onSelectSplineKind).toHaveBeenCalledWith("chain");
    cleanup();

    const row = bag({ activeSubTool: "row" });
    render(<MobileMapEditToolPanels {...row} />);
    fireEvent.click(screen.getByRole("button", { name: /Lamp/i }));
    expect(row.onSelectAsset).toHaveBeenCalledWith("objects:lamp");
  });

  it("renders a panel for every tool PANEL_TOOLS claims has one", () => {
    // The sheet keeps itself open for exactly these tools. A tool listed here
    // with an empty panel would hold the sheet open over nothing.
    for (const tool of PANEL_TOOLS) {
      const { container, unmount } = render(
        <MobileMapEditToolPanels {...bag({ activeSubTool: tool })} />,
      );
      expect(
        container.querySelectorAll(".mobile-tool-sheet__section").length,
        `${tool} claims a panel but rendered none`,
      ).toBeGreaterThan(0);
      unmount();
    }
  });

  it("renders NOTHING for a tool that has no dials, so the sheet may close", () => {
    for (const tool of ["wall", "door"] as const) {
      expect(PANEL_TOOLS.has(tool)).toBe(false);
      const { container, unmount } = render(
        <MobileMapEditToolPanels {...bag({ activeSubTool: tool })} />,
      );
      expect(container.querySelectorAll(".mobile-tool-sheet__section")).toHaveLength(0);
      unmount();
    }
  });

  // "select" is the ONE deliberate non-drag member, and it is named rather than
  // waved through by a loosened predicate: any OTHER non-drag tool sneaking into
  // PANEL_TOOLS would be a sheet that stays open over a tool touch never arms,
  // which is exactly the silent-no-op failure this mode is worst at.
  it("only ever claims panels for tools the touch path arms, plus select", () => {
    for (const tool of PANEL_TOOLS) {
      expect(isDragTool(tool) || tool === "select").toBe(true);
    }
    expect(PANEL_TOOLS.has("select")).toBe(true);
  });

  // Selection reached a stylesheet and nothing else until the review caught it.
  // The house convention already existed in the components these replace —
  // MapEditBrushDeck and the player dock both mark selection this way — so this
  // pins the dials to it rather than inventing anything.
  it("tells a screen reader which option is selected, not just a CSS class", () => {
    render(<MobileMapEditToolPanels {...bag({ activeSubTool: "hallway", hallwayWidth: 3 })} />);

    const widths = within(section("Width (cells)")).getAllByRole("button");
    const pressed = widths.filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("3");
    // Both halves: every option must carry the attribute, or "exactly one is
    // pressed" would also pass with the attribute present on only one button.
    expect(widths.every((b) => b.hasAttribute("aria-pressed"))).toBe(true);

    const shelves = screen.getByText("Floor").closest(".mobile-tool-sheet__section")!;
    const chips = [...shelves.querySelectorAll(".mobile-chip")];
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.every((c) => c.hasAttribute("aria-pressed"))).toBe(true);
    expect(chips.filter((c) => c.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  // THE NO-LAZY PIN. No await, no findBy, no act — if anything in this subtree
  // is wrapped in React.lazy + Suspense, the fallback is what renders on the
  // first paint and this assertion fails immediately. The slice's answer to
  // React's permanent rejection caching is to have no boundary at all here.
  it("paints synchronously — nothing in the dials is behind a lazy chunk", () => {
    const { container } = render(<MobileMapEditToolPanels {...bag({ activeSubTool: "room" })} />);
    expect(container.querySelector(".mobile-tool-sheet__section")).not.toBeNull();
    expect(screen.getByText(/Wall ring/i)).toBeInTheDocument();
  });
});
