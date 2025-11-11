/**
 * Characterization tests for TurnNavigationControls
 *
 * Component: TurnNavigationControls
 * Purpose: Provides Previous/Next turn navigation arrows for DMs during combat
 *
 * Test Coverage:
 * - Rendering when combat is inactive (should not render)
 * - Rendering when combat is active (should show navigation)
 * - Previous button functionality
 * - Next button functionality
 * - Disabled states for navigation buttons
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TurnNavigationControls } from "../TurnNavigationControls";

describe("TurnNavigationControls", () => {
  describe("Visibility", () => {
    it("should not render when combat is not active", () => {
      const { container } = render(
        <TurnNavigationControls
          combatActive={false}
          onNextTurn={vi.fn()}
          onPreviousTurn={vi.fn()}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should render navigation controls when combat is active", () => {
      render(
        <TurnNavigationControls
          combatActive={true}
          onNextTurn={vi.fn()}
          onPreviousTurn={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });
  });

  describe("Button Interactions", () => {
    it("should call onPreviousTurn when Previous button is clicked", () => {
      const onPreviousTurn = vi.fn();
      render(
        <TurnNavigationControls
          combatActive={true}
          onNextTurn={vi.fn()}
          onPreviousTurn={onPreviousTurn}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /previous/i }));

      expect(onPreviousTurn).toHaveBeenCalledTimes(1);
    });

    it("should call onNextTurn when Next button is clicked", () => {
      const onNextTurn = vi.fn();
      render(
        <TurnNavigationControls
          combatActive={true}
          onNextTurn={onNextTurn}
          onPreviousTurn={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      expect(onNextTurn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Button States", () => {
    it("should enable both buttons by default", () => {
      render(
        <TurnNavigationControls
          combatActive={true}
          onNextTurn={vi.fn()}
          onPreviousTurn={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /previous/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });

    it("should disable Previous button when at first turn", () => {
      render(
        <TurnNavigationControls
          combatActive={true}
          onNextTurn={vi.fn()}
          onPreviousTurn={vi.fn()}
          isFirstTurn={true}
        />
      );

      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();
    });

    it("should disable Next button when at last turn", () => {
      render(
        <TurnNavigationControls
          combatActive={true}
          onNextTurn={vi.fn()}
          onPreviousTurn={vi.fn()}
          isLastTurn={true}
        />
      );

      expect(screen.getByRole("button", { name: /previous/i })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    });
  });
});
