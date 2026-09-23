import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Header, type ToolMode } from "../Header";

const props = {
  uid: "player",
  snapToGrid: true,
  activeTool: null as ToolMode,
  crtFilter: false,
  diceRollerOpen: false,
  rollLogOpen: false,
  onSnapToGridChange: vi.fn(),
  onToolSelect: vi.fn(),
  onCrtFilterChange: vi.fn(),
  onDiceRollerToggle: vi.fn(),
  onRollLogToggle: vi.fn(),
  onResetCamera: vi.fn(),
};

describe("player navigation", () => {
  it("makes Move an explicit active state and exit from every displayed tool", () => {
    const onToolSelect = vi.fn();
    const { rerender } = render(<Header {...props} onToolSelect={onToolSelect} />);
    expect(screen.getByRole("button", { name: "✥ Move", pressed: true })).toBeInTheDocument();
    for (const activeTool of ["draw", "pointer", "measure", "transform", "select"] as const) {
      rerender(<Header {...props} activeTool={activeTool} onToolSelect={onToolSelect} />);
      fireEvent.click(screen.getByRole("button", { name: "✥ Move", pressed: false }));
      expect(onToolSelect).toHaveBeenLastCalledWith(null);
    }
  });

  it("separates labelled tool and panel groups without changing the panel action", () => {
    const onRollLogToggle = vi.fn();
    render(
      <Header {...props} isDM onPlayerLensChange={vi.fn()} onRollLogToggle={onRollLogToggle} />,
    );
    const tools = within(screen.getByRole("group", { name: "Play tools" }));
    expect(tools.getByRole("button", { name: "👆 Ping" })).toBeInTheDocument();
    expect(tools.getByRole("button", { name: "✏️ Draw" })).toBeInTheDocument();
    expect(tools.getByRole("button", { name: "🏗️ Map" })).toBeInTheDocument();
    expect(tools.queryByRole("button", { name: "👁 Player View" })).not.toBeInTheDocument();
    const panels = within(screen.getByRole("group", { name: "Panels & settings" }));
    expect(panels.getByRole("button", { name: "👁 Player View" })).toBeInTheDocument();
    fireEvent.click(panels.getByRole("button", { name: "📜 Chat & Rolls" }));
    expect(onRollLogToggle).toHaveBeenCalledExactlyOnceWith(true);
  });
});
