import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileFloatingControls } from "../MobileFloatingControls";
import { toolbar, props, dock } from "./mobileMapEditPalette.fixtures";
import { boundPalette } from "../../../features/map-edit/__tests__/characterization/palette.fixtures";
import { TOOL_DESCRIPTORS } from "../../../features/map-edit/mapEditToolDescriptors";
afterEach(cleanup);
import { isTouchTool } from "../../../features/map-edit/mapEditToolKinds";
import {
  TOUCH_TOOL_COUNT,
  MOBILE_TOOL_TILES,
} from "../../../features/map-edit/mobile/mobileToolTiles";
describe("once live", () => {
  const live = (overrides: Record<string, unknown> = {}) =>
    props({ surface: "tools", mapEditToolbarProps: toolbar({ isLive: true, ...overrides }) });

  // M5's one behavioural change. Both halves are required: a rule that never
  // closes passes the Room half alone, and one that always closes passes the
  // Wall half alone.
  it("closes the sheet for a dial-less tool and keeps it open for one with dials", () => {
    const bar = toolbar({ isLive: true });
    const onToggleSurface = vi.fn();
    render(
      <MobileFloatingControls
        {...props({ surface: "tools", mapEditToolbarProps: bar, onToggleSurface })}
      />,
    );
    const sheet = screen.getByRole("dialog", { name: /map tools/i });

    // Wall has no dials: you picked it in order to USE it, and it needs the
    // canvas that the sheet is covering.
    fireEvent.click(within(sheet).getByRole("button", { name: /^Wall$/ }));
    expect(bar.onSelectSubTool).toHaveBeenCalledWith("wall");
    expect(onToggleSurface).toHaveBeenCalledWith("tools");

    onToggleSurface.mockClear();

    // Room has dials. Closing over them would hide the options behind a
    // reopen the DM has no way to know is needed.
    fireEvent.click(within(sheet).getByRole("button", { name: /^Room$/ }));
    expect(bar.onSelectSubTool).toHaveBeenCalledWith("room");
    expect(onToggleSurface).not.toHaveBeenCalled();
  });

  it("shows the dials of the armed tool, and an explicit way back to the map", () => {
    const onToggleSurface = vi.fn();
    render(
      <MobileFloatingControls
        {...props({
          surface: "tools",
          mapEditToolbarProps: toolbar({ isLive: true, activeSubTool: "room" }),
          onToggleSurface,
        })}
      />,
    );

    expect(screen.getByText("Wall ring")).toBeInTheDocument();
    expect(screen.getByText("Floor")).toBeInTheDocument();

    // Not "Use Room": a second button carrying a tool's name would make the
    // e2e tile locators ambiguous and fail as a strict-mode violation.
    fireEvent.click(screen.getByRole("button", { name: /To the map/i }));
    expect(onToggleSurface).toHaveBeenCalledWith("tools");
  });

  it("marks the armed sub-tool, so the DM can tell room from wall without dragging", () => {
    render(<MobileFloatingControls {...live({ activeSubTool: "room" })} />);

    expect(screen.getByRole("button", { name: /Room/ }).className).toContain(
      "mobile-tool-sheet__button--active",
    );
    expect(screen.getByRole("button", { name: /Wall/ }).className).not.toContain(
      "mobile-tool-sheet__button--active",
    );
  });

  it("enables Undo and Redo only when the controller has history", () => {
    const { unmount } = render(<MobileFloatingControls {...live()} />);
    expect(within(dock()).getByRole("button", { name: /Undo/ })).toBeDisabled();
    unmount();

    render(<MobileFloatingControls {...live({ canUndo: true, canRedo: true })} />);
    expect(within(dock()).getByRole("button", { name: /Undo/ })).toBeEnabled();
    expect(within(dock()).getByRole("button", { name: /Redo/ })).toBeEnabled();
  });

  it("keeps Recenter reachable — the mode costs the DM the normal tool sheet", () => {
    const onResetCamera = vi.fn();
    const onToggleSurface = vi.fn();
    render(
      <MobileFloatingControls
        {...props({
          surface: "tools",
          mapEditToolbarProps: toolbar({ isLive: true }),
          onResetCamera,
          onToggleSurface,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Recenter/ }));
    expect(onResetCamera).toHaveBeenCalledTimes(1);
    expect(onToggleSurface).toHaveBeenCalledWith("tools");
  });

  it("surfaces a controller error where the DM is looking", () => {
    render(<MobileFloatingControls {...live({ error: "revision conflict" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("revision conflict");
  });

  // The phone is where the in-flight window actually bites: a DM here is
  // authoring over a real round trip, and a gesture finished inside one is
  // dropped. `saving` is the command-in-flight flag — NOT `busy`, which is
  // the create/open/bind round trip and which this same palette spent five
  // milestones mislabelling as "saving…" on the desktop.
  it("shows the save round trip while a command is in flight", () => {
    render(<MobileFloatingControls {...live({ saving: true })} />);

    expect(within(dock()).getByText("Saving…")).toBeVisible();
  });

  it("says nothing when the controller is idle, or merely BINDING", () => {
    const { unmount } = render(<MobileFloatingControls {...live()} />);
    expect(within(dock()).queryByText("Saving…")).toBeNull();
    unmount();

    // The half that matters: wired to the wrong flag this would light up on
    // every bind and stay dark for every command — the exact desktop bug.
    render(<MobileFloatingControls {...live({ busy: true, saving: false })} />);
    expect(within(dock()).queryByText("Saving…")).toBeNull();
  });

  it("adds no sixth SLOT — the chip is not a control", () => {
    render(<MobileFloatingControls {...live({ saving: true })} />);

    expect(within(dock()).getAllByRole("button")).toHaveLength(5);
    expect(within(dock()).getByText("Saving…")).toBeVisible();
  });

  // Scope, stated rather than implied: that pins the chip as a non-control.
  // It does NOT prove the chip stays out of the grid's flow — jsdom does no
  // layout and the theme stylesheet is not loaded here, so losing
  // `position: absolute` keeps every assertion green while the real dock
  // breaks. Measured in a browser instead (375x812): five 63px buttons on
  // one row, dock 68px, chip 98x24 centred above it — and flipping the chip
  // to position:static put the dock on TWO rows at 120px. Landscape
  // 812x375, where the slim-dock media query applies, holds at one row/63px.

  // The grid is DERIVED from DRAG_TOOLS rather than hand-listed. These two
  // are what make that derivation honest instead of decorative: one proves
  // every armed tool is reachable, the other proves nothing else got in.
  it("reaches every tool the touch path arms — one tile each, wired to its own id", () => {
    const h = boundPalette();
    const palette = () => (
      <MobileFloatingControls {...props({ surface: "tools", mapEditToolbarProps: h.props() })} />
    );
    const view = render(palette());
    for (const tile of MOBILE_TOOL_TILES) {
      fireEvent.change(screen.getByRole("combobox", { name: "Tool group" }), {
        target: { value: TOOL_DESCRIPTORS[tile.id].group },
      });
      view.rerender(palette());
      fireEvent.click(screen.getByRole("button", { name: tile.label }));
      expect(h.result.current.state.activeSubTool).toBe(tile.id);
      view.rerender(palette());
    }
    // A tile list that silently lost one would still pass the loop above.
    expect(MOBILE_TOOL_TILES).toHaveLength(TOUCH_TOOL_COUNT);
  });

  it("offers NOTHING the touch path refuses to arm", () => {
    render(<MobileFloatingControls {...live()} />);
    const grid = screen.getByRole("dialog", { name: /map tools/i });

    // This list is EMPTY as of M7, and that is the point rather than a gap.
    // It once held Paint, Erase, Place, Scatter and Light because a tap
    // synthesises compat mouse events a drag does not, so those tools ran
    // twice per tap; M6 closed that at source and M7 gave the click three an
    // aim. There is now no map-edit tool that is shown but unarmed — so what
    // this test defends is the INVARIANT, not the old list: every tile is a
    // tool the touch path arms.
    expect(MOBILE_TOOL_TILES.every((tile) => isTouchTool(tile.id))).toBe(true);

    // And the invariant has teeth only if the grid really is the tile list.
    // A stray hand-written button would be a tool with no arming behind it,
    // which is exactly the silent-no-op this mode is worst at. Select and
    // Recenter are the two deliberate extras; Select gets its own test below.
    //
    // The TOOL grid specifically, not the dialog: the dialog also holds the
    // ✕ close button and the populate footer, and a panel's swatch row wears
    // the same grid class further down.
    const tiles = grid.querySelector(".map-edit-tool-groups .map-edit-tool-grid") as HTMLElement;
    const labels = within(tiles)
      .getAllByRole("button")
      .map((button) => button.textContent?.replace(/^\P{L}+/u, "") ?? "");
    // The four deliberate extras. Select and Sample resolve on the compat
    // mouse path rather than being armed (so they are not TouchTools and not
    // tiles); Recenter is a camera action; Layers edits the DOCUMENT rather
    // than drawing on it, and is a grid cell only because a full-width row
    // cost 16px of map (see mobile-map-edit-panels.spec.ts).
    const known = new Set([
      ...MOBILE_TOOL_TILES.map((tile) => tile.label),
      "Select",
      "Sample",
      "Layers",
      "Recenter",
    ]);
    for (const label of labels) expect(known).toContain(label);
  });

  // Select is reachable but is NOT a tile — the assertion above still pins
  // MOBILE_TOOL_TILES to the armable set, so this proves the control exists
  // without that list having grown an unarmable member to carry it.
  it("arms Select from the sheet without adding it to the tile list", () => {
    const bar = toolbar({ isLive: true });
    render(<MobileFloatingControls {...props({ surface: "tools", mapEditToolbarProps: bar })} />);

    const sheet = screen.getByRole("dialog", { name: /map tools/i });
    fireEvent.click(within(sheet).getByRole("button", { name: /^Select$/ }));

    expect(bar.onSelectSubTool).toHaveBeenCalledWith("select");
    expect(MOBILE_TOOL_TILES.some((tile) => (tile.id as string) === "select")).toBe(false);
  });

  // The SAME two-flag rule the SAVING chip above pins, applied to the layers
  // panel's guard: it shipped fed `busy`, which is over before the panel can
  // render, so every disable and throttle in it was inert while a command
  // was actually in flight. Discriminating pair — a swap back fails one.
  it("the layers panel gates on saving, not on the bind round trip", () => {
    const layer = {
      id: "lighting",
      name: "Lighting",
      kind: "lighting",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 40,
    };
    const { unmount } = render(
      <MobileFloatingControls
        {...live({
          layersOpen: true,
          layers: [layer],
          onUpdateLayer: vi.fn(),
          saving: true,
          busy: false,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /Hide Lighting/ })).toBeDisabled();
    unmount();

    render(
      <MobileFloatingControls
        {...live({
          layersOpen: true,
          layers: [layer],
          onUpdateLayer: vi.fn(),
          saving: false,
          busy: true,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /Hide Lighting/ })).toBeEnabled();
  });
});
