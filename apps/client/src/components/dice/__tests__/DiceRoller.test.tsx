/**
 * Component tests for DiceRoller
 *
 * Tests the main dice roller orchestrator component, including:
 * - Initial render state
 * - Adding dice with auto-increment behavior
 * - Adding modifiers
 * - Rolling dice with animation
 * - Clearing build
 * - Result display
 *
 * Source: apps/client/src/components/dice/DiceRoller.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { DiceRoller } from "../DiceRoller";
import type { RollLogEntry } from "../rollLogTypes";
import { DIE_SYMBOLS } from "../types";

// No diceLogic mock any more: nothing random happens on this side. The roller
// sends a formula and the SERVER answers, which arrives as `latestOwnRoll`.
function serverRoll(id: string, total = 15): RollLogEntry {
  return {
    id,
    playerUid: "me",
    playerName: "Me",
    formula: "d20",
    perDie: [{ tokenId: "t0", die: "d20", rolls: [total], subtotal: total }],
    total,
    timestamp: 0,
  };
}

/**
 * The build strip only.
 *
 * These assertions used to be `screen.getByText("d20")` — which matched the
 * ADD D20 button in the dice bar, present from the first render, so they
 * passed before any die was added and could not fail. The strip renders a die
 * as its SYMBOL, so that is what proves a token is really in the build.
 */
const strip = () => within(screen.getByTestId("dice-build-strip"));

describe("DiceRoller", () => {
  const mockOnClose = vi.fn();
  const mockOnRoll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial Render", () => {
    it("should render without crashing", () => {
      const { container } = render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      expect(container).toBeTruthy();
    });

    it("should render with Dice Roller title", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      expect(screen.getByText(/dice roller/i)).toBeInTheDocument();
    });

    it("should render dice buttons", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      expect(screen.getByRole("button", { name: /add d20/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add d6/i })).toBeInTheDocument();
    });

    it("should render Roll button disabled when empty", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      const rollButton = screen.getByRole("button", { name: /roll dice/i });
      expect(rollButton).toBeDisabled();
    });

    it("should show empty state message", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      expect(screen.getByText(/add dice to start building/i)).toBeInTheDocument();
    });
  });

  describe("Adding Dice", () => {
    it("should add a die to the build", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));

      expect(screen.queryByText(/add dice to start building/i)).not.toBeInTheDocument();
      expect(strip().getByText(DIE_SYMBOLS.d20)).toBeInTheDocument();
    });

    it("should add multiple different dice", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add d6/i }));

      expect(strip().getByText(DIE_SYMBOLS.d20)).toBeInTheDocument();
      expect(strip().getByText(DIE_SYMBOLS.d6)).toBeInTheDocument();
    });

    it("should enable Roll button when dice are added", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));

      const rollButton = screen.getByRole("button", { name: /roll dice/i });
      expect(rollButton).not.toBeDisabled();
    });
  });

  describe("Adding Modifiers", () => {
    it("should add positive modifier", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));

      expect(screen.queryByText(/add dice to start building/i)).not.toBeInTheDocument();
    });

    it("should enable Roll button when modifiers are added", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));

      const rollButton = screen.getByRole("button", { name: /roll dice/i });
      expect(rollButton).not.toBeDisabled();
    });
  });

  describe("Rolling Dice", () => {
    it("should disable Roll button during animation", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      const rollButton = screen.getByRole("button", { name: /roll dice/i });

      fireEvent.click(rollButton);

      expect(rollButton).toBeDisabled();
    });

    it("should trigger roll when Roll button is clicked", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      const rollButton = screen.getByRole("button", { name: /roll dice/i });

      expect(rollButton).not.toBeDisabled();
      fireEvent.click(rollButton);
      expect(rollButton).toBeDisabled(); // Disabled while the answer is in flight
    });

    it("sends the formula and no result of its own", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      expect(mockOnRoll).toHaveBeenCalledWith({
        formula: "d20 + 1",
        mode: "normal",
        visibility: "public",
      });
    });

    it("shows the SERVER's total when the snapshot brings it back", () => {
      const { rerender } = render(
        <DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} latestOwnRoll={null} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));
      rerender(
        <DiceRoller
          onClose={mockOnClose}
          onRoll={mockOnRoll}
          latestOwnRoll={serverRoll("r1", 17)}
        />,
      );
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByTestId("roll-result-total").textContent).toBe("17");
    });

    it("carries advantage and visibility from the option toggles", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: "DIS" }));
      fireEvent.click(screen.getByRole("button", { name: "DM" }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      expect(mockOnRoll).toHaveBeenCalledWith({
        formula: "d20",
        mode: "disadvantage",
        visibility: "dm",
      });
    });

    it("rolls a built-in macro with the macro's own mode", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: "ADV d20" }));

      expect(mockOnRoll).toHaveBeenCalledWith({
        formula: "d20",
        mode: "advantage",
        visibility: "public",
      });
    });
  });

  describe("Clearing Build", () => {
    it("should have clear button when build has items", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      expect(strip().getByText(DIE_SYMBOLS.d20)).toBeInTheDocument();

      // Should have clear button
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    });

    it("should disable Roll button after clearing", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /clear/i }));

      const rollButton = screen.getByRole("button", { name: /roll dice/i });
      expect(rollButton).toBeDisabled();
    });
  });

  describe("Complex Interactions", () => {
    it("should handle build with dice and modifiers", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add d6/i }));
      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));

      expect(strip().getByText(DIE_SYMBOLS.d20)).toBeInTheDocument();
      expect(strip().getByText(DIE_SYMBOLS.d6)).toBeInTheDocument();
    });

    it("should enable roll button with complex build", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));

      const rollButton = screen.getByRole("button", { name: /roll dice/i });
      expect(rollButton).not.toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should not crash if onRoll is undefined", () => {
      render(<DiceRoller onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll dice/i }));

      // Should not throw error - just check component is still there
      expect(strip().getByText(DIE_SYMBOLS.d20)).toBeInTheDocument();
    });

    it("should handle rapid clicking of add buttons", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      const addD20 = screen.getByRole("button", { name: /add d20/i });

      fireEvent.click(addD20);
      fireEvent.click(addD20);
      fireEvent.click(addD20);

      // Should only have one d20 token (with qty=3)
      // One token, carrying all three: addDie increments rather than appending,
      // and now does it with a functional update, so a batched burst cannot
      // drop one of the clicks.
      expect(strip().getAllByText(DIE_SYMBOLS.d20)).toHaveLength(1);
      expect(strip().getByText("×3")).toBeInTheDocument();
    });
  });
});
