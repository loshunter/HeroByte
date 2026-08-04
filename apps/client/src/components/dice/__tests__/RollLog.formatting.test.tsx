/**
 * Tests for RollLog formatting improvements for long formulas
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RollLog } from "../RollLog";
import type { Build } from "../types";
import type { RollLogEntry } from "../rollLogTypes";
import { formulaFromBuild } from "../diceLogic";

// Helper to create a roll entry
function createRoll(tokens: Build, playerName = "Test Player"): RollLogEntry {
  // A roll is what the SERVER sent back, so the build only shapes the
  // fixture: the formula string and one breakdown entry per term, with as
  // many faces as the term had dice (the row label reads its quantity from
  // there now, not from a token array history entries never carried).
  return {
    id: `roll-${Math.random()}`,
    formula: formulaFromBuild(tokens),
    perDie: tokens.map((token) =>
      token.kind === "die"
        ? {
            tokenId: token.id,
            die: token.die,
            rolls: Array.from({ length: token.qty }, (_, i) => i + 1),
            subtotal: 6,
          }
        : { tokenId: token.id, subtotal: token.value },
    ),
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

    // The compact line is the SERVER's canonical formula now — spaced
    // operators, "2d20 + 3d12 + 2d10 + 4d6 + 15" — not a locally rebuilt
    // "2d20 3d12 2d10 4d6 +15" string.
    const compactText = screen.getByText("2d20 + 3d12 + 2d10 + 4d6 + 15");
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

  describe("badges", () => {
    // The badge row is the ONLY thing in the log that distinguishes an
    // advantage roll from a normal one, or a private roll from a public one.
    const withFlags = (flags: Partial<RollLogEntry>): RollLogEntry => ({
      ...createRoll([{ kind: "die", die: "d20", qty: 1, id: "1" }]),
      ...flags,
    });

    const renderLog = (roll: RollLogEntry) =>
      render(
        <RollLog
          rolls={[roll]}
          onClearLog={mockOnClearLog}
          onViewRoll={mockOnViewRoll}
          onClose={mockOnClose}
        />,
      );

    it("shows no badges on a plain public roll", () => {
      renderLog(withFlags({}));
      expect(screen.queryAllByTestId("roll-badge")).toHaveLength(0);
    });

    it.each([
      [{ mode: "advantage" as const }, "ADV"],
      [{ mode: "disadvantage" as const }, "DIS"],
      [{ visibility: "dm" as const }, "DM ONLY"],
      [{ visibility: "self" as const }, "PRIVATE"],
    ])("badges %o as %s", (flags, label) => {
      renderLog(withFlags(flags));
      expect(screen.getByTestId("roll-badge")).toHaveTextContent(label);
    });

    it("shows both a mode and a visibility badge together", () => {
      renderLog(withFlags({ mode: "advantage", visibility: "self" }));
      expect(screen.getAllByTestId("roll-badge").map((n) => n.textContent)).toEqual([
        "ADV",
        "PRIVATE",
      ]);
    });
  });
});
