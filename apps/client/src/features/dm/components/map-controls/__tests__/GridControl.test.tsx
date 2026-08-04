/**
 * Tests for the diagonal-rule control (S6)
 *
 * It sits inside Grid Controls, beside "Square Size", because the two answer
 * the same question — how many feet is that? — and the existing hint text
 * already pointed at the measure tool.
 *
 * Source: apps/client/src/features/dm/components/map-controls/GridControl.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GridControl } from "../GridControl";

function renderControl(overrides: Partial<Parameters<typeof GridControl>[0]> = {}) {
  const onDiagonalRuleChange = vi.fn();
  render(
    <GridControl
      gridSize={50}
      gridSquareSize={5}
      gridLocked={false}
      onGridSizeChange={vi.fn()}
      onGridLockToggle={vi.fn()}
      onDiagonalRuleChange={onDiagonalRuleChange}
      {...overrides}
    />,
  );
  return { onDiagonalRuleChange };
}

describe("GridControl — diagonal rule", () => {
  it("offers all three rules", () => {
    renderControl();
    expect(screen.getByRole("button", { name: "5e" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pathfinder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Euclidean" })).toBeInTheDocument();
  });

  it("sends the rule the DM picked", () => {
    const { onDiagonalRuleChange } = renderControl();

    fireEvent.click(screen.getByRole("button", { name: "Pathfinder" }));

    expect(onDiagonalRuleChange).toHaveBeenCalledWith("pathfinder");
  });

  it("marks the room's current rule as the active button", () => {
    renderControl({ diagonalRule: "euclidean" });

    expect(screen.getByRole("button", { name: "Euclidean" }).className).toContain(
      "jrpg-button-primary",
    );
    expect(screen.getByRole("button", { name: "5e" }).className).not.toContain(
      "jrpg-button-primary",
    );
  });

  it("defaults to 5e when the room sent no rule", () => {
    renderControl({ diagonalRule: undefined });

    expect(screen.getByRole("button", { name: "5e" }).className).toContain("jrpg-button-primary");
  });

  it("explains what the chosen rule costs a diagonal", () => {
    renderControl({ diagonalRule: "pathfinder" });

    expect(screen.getByText(/A 2-square diagonal is 15 ft/)).toBeInTheDocument();
  });

  it("stays reachable when the grid is LOCKED", () => {
    // "Grid locked" freezes the grid's SIZES. How the table counts a diagonal
    // is a rules decision, not a size, and a DM should not have to unlock the
    // grid — and risk nudging it — to change it.
    renderControl({ gridLocked: true });

    expect(screen.getByRole("button", { name: "Pathfinder" })).toBeInTheDocument();
  });

  it("shows no control at all when there is no handler — no dead buttons", () => {
    // Same convention as the monster-HP section: a control the caller has not
    // wired must not appear.
    renderControl({ onDiagonalRuleChange: undefined });

    expect(screen.queryByRole("button", { name: "Pathfinder" })).not.toBeInTheDocument();
  });
});
