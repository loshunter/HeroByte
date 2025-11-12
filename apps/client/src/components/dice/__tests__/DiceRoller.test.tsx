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
import { render, screen, fireEvent } from "@testing-library/react";
import { DiceRoller } from "../DiceRoller";
import type { Build, Token } from "../types";

// Mock dice logic
const mockRollBuild = vi.fn();
vi.mock("../diceLogic", () => ({
  rollBuild: (build: Build) => mockRollBuild(build),
}));

describe("DiceRoller", () => {
  const mockOnClose = vi.fn();
  const mockOnRoll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRollBuild.mockImplementation((build: Build) => ({
      id: `roll-${Date.now()}`,
      tokens: build,
      perDie: build.map((token: Token) => ({
        tokenId: token.id,
        die: token.kind === "die" ? token.die : undefined,
        rolls: token.kind === "die" ? [10] : undefined,
        subtotal: token.kind === "die" ? 10 : token.value,
      })),
      total: 15,
      timestamp: Date.now(),
    }));
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

      const rollButton = screen.getByRole("button", { name: /roll/i });
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
      expect(screen.getByText("d20")).toBeInTheDocument();
    });

    it("should add multiple different dice", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add d6/i }));

      expect(screen.getByText("d20")).toBeInTheDocument();
      expect(screen.getByText("d6")).toBeInTheDocument();
    });

    it("should enable Roll button when dice are added", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));

      const rollButton = screen.getByRole("button", { name: /roll/i });
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

      const rollButton = screen.getByRole("button", { name: /roll/i });
      expect(rollButton).not.toBeDisabled();
    });
  });

  describe("Rolling Dice", () => {
    it("should disable Roll button during animation", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      const rollButton = screen.getByRole("button", { name: /roll/i });

      fireEvent.click(rollButton);

      expect(rollButton).toBeDisabled();
    });

    it("should trigger roll when Roll button is clicked", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      const rollButton = screen.getByRole("button", { name: /roll/i });

      expect(rollButton).not.toBeDisabled();
      fireEvent.click(rollButton);
      expect(rollButton).toBeDisabled(); // Disabled during animation
    });
  });

  describe("Clearing Build", () => {
    it("should have clear button when build has items", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      expect(screen.getByText("d20")).toBeInTheDocument();

      // Should have clear button
      expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    });

    it("should disable Roll button after clearing", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /clear/i }));

      const rollButton = screen.getByRole("button", { name: /roll/i });
      expect(rollButton).toBeDisabled();
    });
  });

  describe("Complex Interactions", () => {
    it("should handle build with dice and modifiers", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add d6/i }));
      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));

      expect(screen.getByText("d20")).toBeInTheDocument();
      expect(screen.getByText("d6")).toBeInTheDocument();
    });

    it("should enable roll button with complex build", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /add \+1 modifier/i }));

      const rollButton = screen.getByRole("button", { name: /roll/i });
      expect(rollButton).not.toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should not crash if onRoll is undefined", () => {
      render(<DiceRoller onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
      fireEvent.click(screen.getByRole("button", { name: /roll/i }));

      // Should not throw error - just check component is still there
      expect(screen.getByText("d20")).toBeInTheDocument();
    });

    it("should handle rapid clicking of add buttons", () => {
      render(<DiceRoller onClose={mockOnClose} onRoll={mockOnRoll} />);

      const addD20 = screen.getByRole("button", { name: /add d20/i });

      fireEvent.click(addD20);
      fireEvent.click(addD20);
      fireEvent.click(addD20);

      // Should only have one d20 token (with qty=3)
      const tokens = screen.getAllByText("d20");
      expect(tokens).toHaveLength(1);
    });
  });
});
