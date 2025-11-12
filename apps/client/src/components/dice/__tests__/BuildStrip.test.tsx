/**
 * Component tests for BuildStrip
 *
 * Tests the dice build strip component that displays tokens, including:
 * - Empty state display
 * - Rendering dice tokens
 * - Rendering modifier tokens
 * - Operator display (+/−) between tokens
 * - Token removal
 * - Quantity updates
 * - Modifier value updates
 *
 * Source: apps/client/src/components/dice/BuildStrip.tsx
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BuildStrip } from "../BuildStrip";
import type { Build, Token } from "../types";

interface DiceTokenProps {
  token: Token;
  onRemove: () => void;
  onUpdateQty?: (qty: number) => void;
  onUpdateMod?: (value: number) => void;
  isAnimating?: boolean;
}

// Mock DiceToken component
vi.mock("../DiceToken", () => ({
  DiceToken: ({ token, onRemove, onUpdateQty, onUpdateMod, isAnimating }: DiceTokenProps) => (
    <div data-testid={`dice-token-${token.id}`}>
      <span data-testid={`token-kind-${token.id}`}>{token.kind}</span>
      {token.kind === "die" && (
        <>
          <span data-testid={`token-die-${token.id}`}>{token.die}</span>
          <span data-testid={`token-qty-${token.id}`}>{token.qty}</span>
          {onUpdateQty && <button onClick={() => onUpdateQty(token.qty + 1)}>Update Qty</button>}
        </>
      )}
      {token.kind === "mod" && (
        <>
          <span data-testid={`token-value-${token.id}`}>{token.value}</span>
          {onUpdateMod && <button onClick={() => onUpdateMod(token.value + 1)}>Update Mod</button>}
        </>
      )}
      <button onClick={onRemove}>Remove</button>
      <span data-testid={`token-animating-${token.id}`}>
        {isAnimating ? "animating" : "static"}
      </span>
    </div>
  ),
}));

describe("BuildStrip", () => {
  const mockOnUpdateBuild = vi.fn();

  beforeEach(() => {
    mockOnUpdateBuild.mockClear();
  });

  describe("Empty State", () => {
    it("should show empty state message when build is empty", () => {
      const build: Build = [];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByText(/add dice to start building/i)).toBeInTheDocument();
    });

    it("should not render any tokens when build is empty", () => {
      const build: Build = [];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.queryByTestId(/^dice-token-/)).not.toBeInTheDocument();
    });
  });

  describe("Single Token Rendering", () => {
    it("should render a single die token", () => {
      const build: Build = [{ kind: "die", die: "d20", qty: 1, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("dice-token-token-1")).toBeInTheDocument();
      expect(screen.getByTestId("token-kind-token-1")).toHaveTextContent("die");
      expect(screen.getByTestId("token-die-token-1")).toHaveTextContent("d20");
      expect(screen.getByTestId("token-qty-token-1")).toHaveTextContent("1");
    });

    it("should render a single positive modifier token", () => {
      const build: Build = [{ kind: "mod", value: 5, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("dice-token-token-1")).toBeInTheDocument();
      expect(screen.getByTestId("token-kind-token-1")).toHaveTextContent("mod");
      expect(screen.getByTestId("token-value-token-1")).toHaveTextContent("5");
    });

    it("should render a single negative modifier token", () => {
      const build: Build = [{ kind: "mod", value: -3, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("dice-token-token-1")).toBeInTheDocument();
      expect(screen.getByTestId("token-value-token-1")).toHaveTextContent("-3");
    });

    it("should not show operator for single token", () => {
      const build: Build = [{ kind: "die", die: "d6", qty: 2, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.queryByText("+")).not.toBeInTheDocument();
      expect(screen.queryByText("−")).not.toBeInTheDocument();
    });
  });

  describe("Multiple Token Rendering", () => {
    it("should render multiple dice tokens", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "die", die: "d6", qty: 2, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("dice-token-token-1")).toBeInTheDocument();
      expect(screen.getByTestId("dice-token-token-2")).toBeInTheDocument();
    });

    it("should show + operator before positive modifier", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "mod", value: 5, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("should show − operator before negative modifier", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "mod", value: -3, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByText("−")).toBeInTheDocument();
    });

    it("should not show operator before first token even if it's a modifier", () => {
      const build: Build = [
        { kind: "mod", value: 5, id: "token-1" },
        { kind: "die", die: "d20", qty: 1, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      // Should have the + sign but only before the second token (which is a die, so no operator)
      // Actually, operators only show before modifiers, so in this case no operators
      expect(screen.queryByText("+")).not.toBeInTheDocument();
      expect(screen.queryByText("−")).not.toBeInTheDocument();
    });

    it("should render complex build with dice and modifiers", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "die", die: "d6", qty: 3, id: "token-2" },
        { kind: "mod", value: 5, id: "token-3" },
        { kind: "mod", value: -2, id: "token-4" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("dice-token-token-1")).toBeInTheDocument();
      expect(screen.getByTestId("dice-token-token-2")).toBeInTheDocument();
      expect(screen.getByTestId("dice-token-token-3")).toBeInTheDocument();
      expect(screen.getByTestId("dice-token-token-4")).toBeInTheDocument();

      // Should have + before token-3 and − before token-4
      expect(screen.getByText("+")).toBeInTheDocument();
      expect(screen.getByText("−")).toBeInTheDocument();
    });
  });

  describe("Animation State", () => {
    it("should pass isAnimating=false by default", () => {
      const build: Build = [{ kind: "die", die: "d20", qty: 1, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("token-animating-token-1")).toHaveTextContent("static");
    });

    it("should pass isAnimating=true when prop is set", () => {
      const build: Build = [{ kind: "die", die: "d20", qty: 1, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} isAnimating={true} />);

      expect(screen.getByTestId("token-animating-token-1")).toHaveTextContent("animating");
    });
  });

  describe("Token Interactions", () => {
    it("should call onUpdateBuild when token is removed", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "die", die: "d6", qty: 2, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      const removeButton = screen.getAllByText("Remove")[0];
      removeButton.click();

      expect(mockOnUpdateBuild).toHaveBeenCalledWith([
        { kind: "die", die: "d6", qty: 2, id: "token-2" },
      ]);
    });

    it("should call onUpdateBuild when die quantity is updated", () => {
      const build: Build = [{ kind: "die", die: "d20", qty: 1, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      const updateQtyButton = screen.getByText("Update Qty");
      updateQtyButton.click();

      expect(mockOnUpdateBuild).toHaveBeenCalledWith([
        { kind: "die", die: "d20", qty: 2, id: "token-1" },
      ]);
    });

    it("should call onUpdateBuild when modifier value is updated", () => {
      const build: Build = [{ kind: "mod", value: 5, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      const updateModButton = screen.getByText("Update Mod");
      updateModButton.click();

      expect(mockOnUpdateBuild).toHaveBeenCalledWith([{ kind: "mod", value: 6, id: "token-1" }]);
    });

    it("should update only the targeted token when updating quantity", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "die", die: "d6", qty: 2, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      const updateButtons = screen.getAllByText("Update Qty");
      updateButtons[1].click(); // Update second token

      expect(mockOnUpdateBuild).toHaveBeenCalledWith([
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "die", die: "d6", qty: 3, id: "token-2" },
      ]);
    });

    it("should not modify modifier tokens when updating die quantity", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "mod", value: 5, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      const updateQtyButton = screen.getByText("Update Qty");
      updateQtyButton.click();

      expect(mockOnUpdateBuild).toHaveBeenCalledWith([
        { kind: "die", die: "d20", qty: 2, id: "token-1" },
        { kind: "mod", value: 5, id: "token-2" },
      ]);
    });

    it("should not modify die tokens when updating modifier value", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "mod", value: 5, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      const updateModButton = screen.getByText("Update Mod");
      updateModButton.click();

      expect(mockOnUpdateBuild).toHaveBeenCalledWith([
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "mod", value: 6, id: "token-2" },
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero modifier value", () => {
      const build: Build = [
        { kind: "die", die: "d20", qty: 1, id: "token-1" },
        { kind: "mod", value: 0, id: "token-2" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      // Zero is >= 0, so should show + operator
      expect(screen.getByText("+")).toBeInTheDocument();
      expect(screen.getByTestId("token-value-token-2")).toHaveTextContent("0");
    });

    it("should handle all die types", () => {
      const build: Build = [
        { kind: "die", die: "d4", qty: 1, id: "token-1" },
        { kind: "die", die: "d6", qty: 1, id: "token-2" },
        { kind: "die", die: "d8", qty: 1, id: "token-3" },
        { kind: "die", die: "d10", qty: 1, id: "token-4" },
        { kind: "die", die: "d12", qty: 1, id: "token-5" },
        { kind: "die", die: "d20", qty: 1, id: "token-6" },
        { kind: "die", die: "d100", qty: 1, id: "token-7" },
      ];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("token-die-token-1")).toHaveTextContent("d4");
      expect(screen.getByTestId("token-die-token-2")).toHaveTextContent("d6");
      expect(screen.getByTestId("token-die-token-3")).toHaveTextContent("d8");
      expect(screen.getByTestId("token-die-token-4")).toHaveTextContent("d10");
      expect(screen.getByTestId("token-die-token-5")).toHaveTextContent("d12");
      expect(screen.getByTestId("token-die-token-6")).toHaveTextContent("d20");
      expect(screen.getByTestId("token-die-token-7")).toHaveTextContent("d100");
    });

    it("should handle large quantity values", () => {
      const build: Build = [{ kind: "die", die: "d6", qty: 100, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("token-qty-token-1")).toHaveTextContent("100");
    });

    it("should handle large modifier values", () => {
      const build: Build = [{ kind: "mod", value: 999, id: "token-1" }];

      render(<BuildStrip build={build} onUpdateBuild={mockOnUpdateBuild} />);

      expect(screen.getByTestId("token-value-token-1")).toHaveTextContent("999");
    });
  });
});
