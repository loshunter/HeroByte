/**
 * Component tests for MobileDiceRoller
 *
 * Regression focus: after rolling, the result must be visible inside the
 * roller itself (players previously had to close the roller and open the
 * roll log because the result panel rendered with zero height).
 *
 * Source: apps/client/src/components/dice/MobileDiceRoller.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MobileDiceRoller } from "../MobileDiceRoller";
import type { Build, Token } from "../types";

// Mock dice logic for deterministic results
const mockRollBuild = vi.fn();
vi.mock("../diceLogic", () => ({
  rollBuild: (build: Build) => mockRollBuild(build),
}));

describe("MobileDiceRoller", () => {
  const mockOnClose = vi.fn();
  const mockOnRoll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRollBuild.mockImplementation((build: Build) => ({
      id: "roll-1",
      tokens: build,
      perDie: build.map((token: Token) => ({
        tokenId: token.id,
        die: token.kind === "die" ? token.die : undefined,
        rolls: token.kind === "die" ? [10] : undefined,
        subtotal: token.kind === "die" ? 10 : token.value,
      })),
      total: 10,
      timestamp: 0,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rollOneD20 = () => {
    fireEvent.click(screen.getByRole("button", { name: /add d20/i }));
    fireEvent.click(screen.getByRole("button", { name: /roll!/i }));
    act(() => {
      vi.advanceTimersByTime(600);
    });
  };

  describe("Rolling", () => {
    it("should show the roll result total inside the roller after rolling", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} onClose={mockOnClose} />);

      rollOneD20();

      expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("10");
    });

    it("should notify parent via onRoll with the roll result", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} onClose={mockOnClose} />);

      rollOneD20();

      expect(mockOnRoll).toHaveBeenCalledTimes(1);
      expect(mockOnRoll).toHaveBeenCalledWith(expect.objectContaining({ total: 10 }));
    });

    it("should not show a result before rolling", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} onClose={mockOnClose} />);

      expect(screen.queryByTestId("mobile-roll-result")).not.toBeInTheDocument();
    });
  });

  describe("Dismissing the result", () => {
    it("should hide the result when its close button is tapped", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} onClose={mockOnClose} />);

      rollOneD20();
      fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

      expect(screen.queryByTestId("mobile-roll-result")).not.toBeInTheDocument();
    });

    it("should keep the build after dismissing so the player can re-roll", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} onClose={mockOnClose} />);

      rollOneD20();
      fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

      expect(screen.getByRole("button", { name: /roll!/i })).not.toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: /roll!/i }));
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(screen.getByTestId("mobile-roll-result")).toBeInTheDocument();
      expect(mockOnRoll).toHaveBeenCalledTimes(2);
    });

    it("should not close the whole roller when dismissing the result", () => {
      render(<MobileDiceRoller onRoll={mockOnRoll} onClose={mockOnClose} />);

      rollOneD20();
      fireEvent.click(screen.getByRole("button", { name: /close roll result/i }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /roll!/i })).toBeInTheDocument();
    });
  });
});
