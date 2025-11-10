/**
 * Tests for RollLog formatting improvements for long formulas
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollLog } from "../RollLog";
import type { RollResult } from "../types";

// Helper to create a roll entry
function createRoll(
  tokens: RollResult["tokens"],
  playerName = "Test Player",
): RollResult & { playerName: string } {
  return {
    id: `roll-${Math.random()}`,
    tokens,
    perDie: tokens.map((token) => ({
      tokenId: token.id,
      ...(token.kind === "die"
        ? { die: token.die, rolls: [1, 2, 3], subtotal: 6 }
        : { subtotal: token.value }),
    })),
    total: 20,
    timestamp: Date.now(),
    playerName,
  };
}

describe("RollLog - Long Formula Formatting", () => {
  const mockOnClearLog = vi.fn();
  const mockOnViewRoll = vi.fn();
  const mockOnClose = vi.fn();

  it("should render short formula with symbols", () => {
    const shortRoll = createRoll([
      { kind: "die", die: "d20", qty: 1, id: "1" },
      { kind: "mod", value: 5, id: "2" },
    ]);

    render(
      <RollLog
        rolls={[shortRoll]}
        onClearLog={mockOnClearLog}
        onViewRoll={mockOnViewRoll}
        onClose={mockOnClose}
      />,
    );

    // Should show the die symbol and formula
    expect(screen.getByText(/d20/i)).toBeInTheDocument();
    expect(screen.getByText("= 20")).toBeInTheDocument();
  });

  it("should render long formula in compact mode by default", () => {
    const longRoll = createRoll([
      { kind: "die", die: "d20", qty: 2, id: "1" },
      { kind: "die", die: "d12", qty: 3, id: "2" },
      { kind: "die", die: "d10", qty: 2, id: "3" },
      { kind: "die", die: "d6", qty: 4, id: "4" },
      { kind: "mod", value: 15, id: "5" },
    ]);

    render(
      <RollLog
        rolls={[longRoll]}
        onClearLog={mockOnClearLog}
        onViewRoll={mockOnViewRoll}
        onClose={mockOnClose}
      />,
    );

    // Should show compact text format for long formula
    // Looking for the compact format: "2d20 3d12 2d10 4d6 +15"
    const compactText = screen.getByText(/2d20.*3d12.*2d10.*4d6.*\+15/);
    expect(compactText).toBeInTheDocument();

    // Should show expand button (⋯)
    expect(screen.getByTitle("Expand formula")).toBeInTheDocument();
  });

  it("should show hint text for long formulas", () => {
    const longRoll = createRoll([
      { kind: "die", die: "d20", qty: 5, id: "1" },
      { kind: "die", die: "d12", qty: 3, id: "2" },
      { kind: "die", die: "d6", qty: 3, id: "3" },
      { kind: "die", die: "d4", qty: 2, id: "4" },
      { kind: "mod", value: 10, id: "5" },
    ]);

    render(
      <RollLog
        rolls={[longRoll]}
        onClearLog={mockOnClearLog}
        onViewRoll={mockOnViewRoll}
        onClose={mockOnClose}
      />,
    );

    // Should show hint about clicking for breakdown
    expect(screen.getByText("Click for breakdown")).toBeInTheDocument();
  });

  it("should not show hint text for short formulas", () => {
    const shortRoll = createRoll([
      { kind: "die", die: "d20", qty: 1, id: "1" },
      { kind: "mod", value: 5, id: "2" },
    ]);

    render(
      <RollLog
        rolls={[shortRoll]}
        onClearLog={mockOnClearLog}
        onViewRoll={mockOnViewRoll}
        onClose={mockOnClose}
      />,
    );

    // Should NOT show hint for short formulas
    expect(screen.queryByText("Click for breakdown")).not.toBeInTheDocument();
  });

  it("should detect long formulas based on token count", () => {
    const fiveTokenRoll = createRoll([
      { kind: "die", die: "d20", qty: 1, id: "1" },
      { kind: "die", die: "d12", qty: 1, id: "2" },
      { kind: "die", die: "d10", qty: 1, id: "3" },
      { kind: "die", die: "d6", qty: 1, id: "4" },
      { kind: "mod", value: 5, id: "5" },
    ]);

    render(
      <RollLog
        rolls={[fiveTokenRoll]}
        onClearLog={mockOnClearLog}
        onViewRoll={mockOnViewRoll}
        onClose={mockOnClose}
      />,
    );

    // Should be treated as long (5+ tokens)
    expect(screen.getByTitle("Expand formula")).toBeInTheDocument();
  });

  it("should render multiple rolls with mixed lengths correctly", () => {
    const rolls = [
      createRoll(
        [
          { kind: "die", die: "d20", qty: 1, id: "1" },
          { kind: "mod", value: 5, id: "2" },
        ],
        "Player 1",
      ),
      createRoll(
        [
          { kind: "die", die: "d20", qty: 5, id: "3" },
          { kind: "die", die: "d12", qty: 3, id: "4" },
          { kind: "die", die: "d10", qty: 2, id: "5" },
          { kind: "die", die: "d6", qty: 10, id: "6" },
          { kind: "mod", value: 25, id: "7" },
        ],
        "Player 2",
      ),
      createRoll([{ kind: "die", die: "d6", qty: 2, id: "8" }], "Player 3"),
    ];

    render(
      <RollLog
        rolls={rolls}
        onClearLog={mockOnClearLog}
        onViewRoll={mockOnViewRoll}
        onClose={mockOnClose}
      />,
    );

    // All three players should be visible
    expect(screen.getByText("Player 1")).toBeInTheDocument();
    expect(screen.getByText("Player 2")).toBeInTheDocument();
    expect(screen.getByText("Player 3")).toBeInTheDocument();

    // Only Player 2's long formula should have expand button (5+ tokens)
    expect(screen.getByTitle("Expand formula")).toBeInTheDocument();
  });
});
