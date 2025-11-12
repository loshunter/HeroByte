/**
 * Component tests for DiceBar
 *
 * Tests the dice bar component that provides buttons for adding dice and modifiers, including:
 * - Rendering all die type buttons
 * - Rendering modifier buttons
 * - Click handlers for dice
 * - Click handlers for modifiers
 * - Accessibility attributes
 *
 * Source: apps/client/src/components/dice/DiceBar.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiceBar } from "../DiceBar";
import type { DieType } from "../types";

describe("DiceBar", () => {
  const mockOnAddDie = vi.fn();
  const mockOnAddModifier = vi.fn();

  beforeEach(() => {
    mockOnAddDie.mockClear();
    mockOnAddModifier.mockClear();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(
        <DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />,
      );

      expect(container).toBeTruthy();
    });

    it("should render all die type buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const dieTypes: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

      dieTypes.forEach((die) => {
        const button = screen.getByRole("button", { name: `Add ${die}` });
        expect(button).toBeInTheDocument();
      });
    });

    it("should render +1 modifier button", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add +1 modifier" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("+1");
    });

    it("should render -1 modifier button", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add -1 modifier" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("−1");
    });

    it("should have correct number of buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const buttons = screen.getAllByRole("button");
      // 7 die buttons + 2 modifier buttons = 9 total
      expect(buttons).toHaveLength(9);
    });
  });

  describe("Die Button Interactions", () => {
    it("should call onAddDie with d4 when d4 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d4" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d4");
      expect(mockOnAddDie).toHaveBeenCalledTimes(1);
    });

    it("should call onAddDie with d6 when d6 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d6" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d6");
    });

    it("should call onAddDie with d8 when d8 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d8" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d8");
    });

    it("should call onAddDie with d10 when d10 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d10" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d10");
    });

    it("should call onAddDie with d12 when d12 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d12" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d12");
    });

    it("should call onAddDie with d20 when d20 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d20" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d20");
    });

    it("should call onAddDie with d100 when d100 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d100" });
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledWith("d100");
    });

    it("should allow clicking die buttons multiple times", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d20" });
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockOnAddDie).toHaveBeenCalledTimes(3);
      expect(mockOnAddDie).toHaveBeenCalledWith("d20");
    });

    it("should not call onAddModifier when die button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d20" });
      fireEvent.click(button);

      expect(mockOnAddModifier).not.toHaveBeenCalled();
    });
  });

  describe("Modifier Button Interactions", () => {
    it("should call onAddModifier with 1 when +1 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add +1 modifier" });
      fireEvent.click(button);

      expect(mockOnAddModifier).toHaveBeenCalledWith(1);
      expect(mockOnAddModifier).toHaveBeenCalledTimes(1);
    });

    it("should call onAddModifier with -1 when -1 button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add -1 modifier" });
      fireEvent.click(button);

      expect(mockOnAddModifier).toHaveBeenCalledWith(-1);
      expect(mockOnAddModifier).toHaveBeenCalledTimes(1);
    });

    it("should allow clicking modifier buttons multiple times", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const plusButton = screen.getByRole("button", { name: "Add +1 modifier" });
      const minusButton = screen.getByRole("button", { name: "Add -1 modifier" });

      fireEvent.click(plusButton);
      fireEvent.click(minusButton);
      fireEvent.click(plusButton);

      expect(mockOnAddModifier).toHaveBeenCalledTimes(3);
      expect(mockOnAddModifier).toHaveBeenNthCalledWith(1, 1);
      expect(mockOnAddModifier).toHaveBeenNthCalledWith(2, -1);
      expect(mockOnAddModifier).toHaveBeenNthCalledWith(3, 1);
    });

    it("should not call onAddDie when modifier button is clicked", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add +1 modifier" });
      fireEvent.click(button);

      expect(mockOnAddDie).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("should have aria-label for all die buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const dieTypes: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

      dieTypes.forEach((die) => {
        const button = screen.getByRole("button", { name: `Add ${die}` });
        expect(button).toHaveAttribute("aria-label", `Add ${die}`);
      });
    });

    it("should have aria-label for modifier buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const plusButton = screen.getByRole("button", { name: "Add +1 modifier" });
      const minusButton = screen.getByRole("button", { name: "Add -1 modifier" });

      expect(plusButton).toHaveAttribute("aria-label", "Add +1 modifier");
      expect(minusButton).toHaveAttribute("aria-label", "Add -1 modifier");
    });

    it("should have title attribute for all die buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const dieTypes: DieType[] = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"];

      dieTypes.forEach((die) => {
        const button = screen.getByRole("button", { name: `Add ${die}` });
        expect(button).toHaveAttribute("title", `Add ${die}`);
      });
    });

    it("should have title attribute for modifier buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const plusButton = screen.getByRole("button", { name: "Add +1 modifier" });
      const minusButton = screen.getByRole("button", { name: "Add -1 modifier" });

      expect(plusButton).toHaveAttribute("title", "Add +1 modifier");
      expect(minusButton).toHaveAttribute("title", "Add -1 modifier");
    });

    it("should have type=button for all buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const buttons = screen.getAllByRole("button");

      buttons.forEach((button) => {
        expect(button).toHaveAttribute("type", "button");
      });
    });
  });

  describe("Event Propagation", () => {
    it("should prevent default on die button click", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d20" });
      const event = fireEvent.click(button);

      // If preventDefault was called, the event should be cancelled
      expect(event).toBe(false);
    });

    it("should prevent default on modifier button click", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add +1 modifier" });
      const event = fireEvent.click(button);

      // If preventDefault was called, the event should be cancelled
      expect(event).toBe(false);
    });
  });

  describe("Button Styling Classes", () => {
    it("should have dice-button class for die buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const button = screen.getByRole("button", { name: "Add d20" });
      expect(button).toHaveClass("dice-button");
    });

    it("should have mod-button class for modifier buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const plusButton = screen.getByRole("button", { name: "Add +1 modifier" });
      const minusButton = screen.getByRole("button", { name: "Add -1 modifier" });

      expect(plusButton).toHaveClass("mod-button");
      expect(minusButton).toHaveClass("mod-button");
    });
  });

  describe("Mixed Interactions", () => {
    it("should handle alternating die and modifier clicks", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const d20Button = screen.getByRole("button", { name: "Add d20" });
      const plusButton = screen.getByRole("button", { name: "Add +1 modifier" });
      const d6Button = screen.getByRole("button", { name: "Add d6" });
      const minusButton = screen.getByRole("button", { name: "Add -1 modifier" });

      fireEvent.click(d20Button);
      fireEvent.click(plusButton);
      fireEvent.click(d6Button);
      fireEvent.click(minusButton);

      expect(mockOnAddDie).toHaveBeenCalledTimes(2);
      expect(mockOnAddDie).toHaveBeenNthCalledWith(1, "d20");
      expect(mockOnAddDie).toHaveBeenNthCalledWith(2, "d6");

      expect(mockOnAddModifier).toHaveBeenCalledTimes(2);
      expect(mockOnAddModifier).toHaveBeenNthCalledWith(1, 1);
      expect(mockOnAddModifier).toHaveBeenNthCalledWith(2, -1);
    });

    it("should handle rapid clicks across different buttons", () => {
      render(<DiceBar onAddDie={mockOnAddDie} onAddModifier={mockOnAddModifier} />);

      const buttons = {
        d4: screen.getByRole("button", { name: "Add d4" }),
        d6: screen.getByRole("button", { name: "Add d6" }),
        d8: screen.getByRole("button", { name: "Add d8" }),
      };

      fireEvent.click(buttons.d4);
      fireEvent.click(buttons.d6);
      fireEvent.click(buttons.d8);
      fireEvent.click(buttons.d4);

      expect(mockOnAddDie).toHaveBeenCalledTimes(4);
      expect(mockOnAddDie).toHaveBeenNthCalledWith(1, "d4");
      expect(mockOnAddDie).toHaveBeenNthCalledWith(2, "d6");
      expect(mockOnAddDie).toHaveBeenNthCalledWith(3, "d8");
      expect(mockOnAddDie).toHaveBeenNthCalledWith(4, "d4");
    });
  });
});
