// U10a — the camera and ping controls say what they do, not what they used to.
//
// Reset view (once Recenter) has never gone to the middle of the map: `reset` is
// applied as { x: 0, y: 0, scale: 1 } (useCameraControl), the world origin at the
// top-left of the view, at 1x. The old name and tooltip promised the middle.
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { Header, type ToolMode } from "../Header";
import { MobileFloatingControls } from "../MobileFloatingControls";
import type { MobileSurface } from "../../../hooks/useMobileSurface";
import { HELP_TOPICS } from "../../../features/help/helpTopics";
import { PING_TITLE, RESET_VIEW_TITLE } from "../viewWords";
import type { MapEditToolbarProps } from "../../../features/map-edit/mapEditTypes";
import type { TableMenuProps } from "../../../features/table/tableMenuProps";

vi.mock("../../../features/table/TableMenu", () => ({ TableMenu: () => null }));

afterEach(() => cleanup());

const table = {
  uid: "u",
  tableName: "Sunday Game",
  isPublicTable: false,
  isConnected: true,
  isDM: false,
  roleKnown: true,
  onToggleDM: vi.fn(),
  crtFilter: false,
  onCrtFilterChange: vi.fn(),
} as TableMenuProps;

const headerProps = {
  table,
  snapToGrid: false,
  activeTool: null as ToolMode,
  diceRollerOpen: false,
  rollLogOpen: false,
  onSnapToGridChange: vi.fn(),
  onToolSelect: vi.fn(),
  onDiceRollerToggle: vi.fn(),
  onRollLogToggle: vi.fn(),
  onResetCamera: vi.fn(),
};

const mobileProps = {
  surface: "tools" as MobileSurface,
  onToggleSurface: vi.fn(),
  onToolSelect: vi.fn(),
  onSnapToGridChange: vi.fn(),
  onResetCamera: vi.fn(),
  activeTool: null,
  snapToGrid: false,
  isDM: false,
  mode: false,
  mapEditToolbarProps: { onClose: vi.fn() } as unknown as MapEditToolbarProps,
};

const RESET_VIEW = /top-left/i;

describe("Reset view's tooltip", () => {
  it("names the real action on the desktop header, and never the middle of the map", () => {
    render(<Header {...headerProps} />);
    const title = screen.getByRole("button", { name: "Reset view" }).getAttribute("title") ?? "";
    expect(title).toBe(RESET_VIEW_TITLE);
    expect(title).toMatch(RESET_VIEW);
    expect(title).toMatch(/100%/);
    expect(title).not.toMatch(/center of (the )?map/i);
  });

  it("is described the same way in the phone's tool sheet", () => {
    render(<MobileFloatingControls {...mobileProps} />);
    // The tile in the sheet and the dock's own button (named the same way) both carry it.
    const buttons = screen.getAllByRole("button", { name: /Reset view/ });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    for (const button of buttons) expect(button.getAttribute("title")).toBe(RESET_VIEW_TITLE);
  });

  it("is described the same way on a player's dock button", () => {
    render(<MobileFloatingControls {...mobileProps} surface={"none" as MobileSurface} />);
    // The dock says "Reset" on the button and "Reset view" to a screen reader: a phone has no
    // hover, so the word on the button is what tells a player what it does.
    const button = screen.getByRole("button", { name: "Reset view" });
    expect(button).toHaveAttribute("title", RESET_VIEW_TITLE);
    expect(button).toHaveTextContent(/Reset/);
  });
});

describe("Ping's tooltip", () => {
  it("says it plants a ping, not that you 'point'", () => {
    render(<Header {...headerProps} />);
    const title = screen.getByRole("button", { name: "👆 Ping" }).getAttribute("title") ?? "";
    expect(title).toMatch(/ping/i);
    expect(title).not.toMatch(/\bpoint at\b/i);
    // Fog hides a PLAYER's ping from players who cannot see the spot, but a DM's ping
    // (the narrator's) reaches everyone (recipientFilter.ts): the tooltip says both.
    expect(title).toBe(PING_TITLE);
    expect(title).toMatch(/A player’s ping reaches the DM and the players who can see that spot/);
    expect(title).toMatch(/a DM’s ping reaches everyone/);
    expect(title).not.toMatch(/everyone sees/i);
  });

  it("the phone's Ping tile carries the same tooltip as the header's Ping button", () => {
    render(<MobileFloatingControls {...mobileProps} />);
    expect(screen.getByRole("button", { name: /Ping/ })).toHaveAttribute("title", PING_TITLE);
  });

  it("the tooltip and the help say who sees a ping in the same words, apostrophes included", () => {
    const audience = PING_TITLE.slice(PING_TITLE.indexOf("A player"));
    expect(audience).toMatch(/^A player’s ping reaches/);
    expect(JSON.stringify(HELP_TOPICS)).toContain(audience);
  });
});
