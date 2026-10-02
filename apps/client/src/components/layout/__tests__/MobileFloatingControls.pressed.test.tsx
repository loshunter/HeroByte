// The phone Tools sheet's choice tiles say whether they are the active one (U10b): the
// six tools and Snap carry aria-pressed, which until now they showed only by colour.
// The tiles that OPEN something (Table, Help, Reset view...) are actions, not choices,
// and carry none.
import type React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileFloatingControls } from "../MobileFloatingControls";
import type { MobileSurface } from "../../../hooks/useMobileSurface";
import type { MapEditToolbarProps } from "../../../features/map-edit/mapEditTypes";

afterEach(() => cleanup());

const sheet = (overrides: Record<string, unknown> = {}) =>
  render(
    <MobileFloatingControls
      {...({
        surface: "tools" as MobileSurface,
        onToggleSurface: vi.fn(),
        onToolSelect: vi.fn(),
        onSnapToGridChange: vi.fn(),
        onResetCamera: vi.fn(),
        activeTool: null,
        snapToGrid: false,
        isDM: false,
        mode: false,
        mapEditToolbarProps: { isLive: false } as unknown as MapEditToolbarProps,
        ...overrides,
      } as unknown as React.ComponentProps<typeof MobileFloatingControls>)}
    />,
  );

const TOOLS = [
  ["Move", null],
  ["Ping", "pointer"],
  ["Measure", "measure"],
  ["Draw", "draw"],
  ["Transform", "transform"],
  ["Select", "select"],
] as const;

it.each(TOOLS)("marks exactly the active tool as pressed (%s)", (name, tool) => {
  sheet({ activeTool: tool });
  for (const [other] of TOOLS) {
    expect(screen.getByRole("button", { name: other })).toHaveAttribute(
      "aria-pressed",
      String(other === name),
    );
  }
});

it("marks Snap as pressed when snapping is on, and not when it is off", () => {
  sheet({ snapToGrid: true });
  expect(screen.getByRole("button", { name: "Snap" })).toHaveAttribute("aria-pressed", "true");
  cleanup();
  sheet({ snapToGrid: false });
  expect(screen.getByRole("button", { name: "Snap" })).toHaveAttribute("aria-pressed", "false");
});

it("leaves the tiles that open something (actions) without aria-pressed", () => {
  sheet();
  for (const name of ["Table", "Reset view", "Help"]) {
    expect(screen.getByRole("button", { name })).not.toHaveAttribute("aria-pressed");
  }
});
