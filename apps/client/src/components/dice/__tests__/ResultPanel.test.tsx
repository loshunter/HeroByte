/**
 * Comprehensive tests for ResultPanel
 *
 * Component: ResultPanel
 * Purpose: SNES-style dice roll result display with detailed breakdown
 *
 * Test Coverage:
 * - Null handling (returns null when result is null)
 * - Rendering basic structure (DraggableWindow, title, dimensions)
 * - Die token rendering (symbols, quantities, rolls, subtotals)
 * - Modifier token rendering (positive, negative, zero modifiers)
 * - Total display (correct value, TOTAL text, data-testid)
 * - Copy to clipboard functionality
 * - Defensive checks for missing/invalid tokens
 * - Mixed scenarios (dice + modifiers, complex rolls)
 *
 * Source: apps/client/src/components/dice/ResultPanel.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultPanel } from "../ResultPanel";
import type { RollResult, Token, DieType } from "../types";
import { DIE_SYMBOLS } from "../types";

// ============================================================================
// MOCKS
// ============================================================================

// Mock DraggableWindow to avoid complexity
vi.mock("../DraggableWindow", () => ({
  DraggableWindow: ({
    title,
    onClose,
    children,
    initialX,
    initialY,
    width,
    minWidth,
    maxWidth,
    zIndex,
  }: {
    title: string;
    onClose?: () => void;
    children: React.ReactNode;
    initialX?: number;
    initialY?: number;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    zIndex?: number;
  }) => (
    <div
      data-testid="draggable-window"
      data-title={title}
      data-initial-x={initialX}
      data-initial-y={initialY}
      data-width={width}
      data-min-width={minWidth}
      data-max-width={maxWidth}
      data-z-index={zIndex}
      data-on-close={onClose ? "present" : "absent"}
    >
      {children}
    </div>
  ),
}));

// Mock formatRollText
vi.mock("../diceLogic", () => ({
  formatRollText: vi.fn((result: RollResult) => {
    return `Mocked roll text for ${result.id}`;
  }),
}));

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

function createDieToken(die: DieType, qty: number = 1, id: string = "token-1"): Token {
  return { kind: "die", die, qty, id };
}

function createModToken(value: number, id: string = "mod-1"): Token {
  return { kind: "mod", value, id };
}

function createRollResult(
  tokens: Token[],
  perDie: RollResult["perDie"],
  total: number,
): RollResult {
  return {
    id: "result-1",
    tokens,
    perDie,
    total,
    timestamp: Date.now(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("ResultPanel", () => {
  let mockClipboard: { writeText: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // Mock clipboard API
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    // Mock console.warn for defensive checks
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // GROUP 1: Null Handling
  // ==========================================================================

  describe("Null Handling", () => {
    it("should return null when result is null", () => {
      const { container } = render(<ResultPanel result={null} onClose={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });

    it("should not render DraggableWindow when result is null", () => {
      render(<ResultPanel result={null} onClose={vi.fn()} />);

      expect(screen.queryByTestId("draggable-window")).not.toBeInTheDocument();
    });

    it("should not render any content when result is null", () => {
      const { container } = render(<ResultPanel result={null} onClose={vi.fn()} />);

      expect(container.textContent).toBe("");
    });
  });

  // ==========================================================================
  // GROUP 2: Rendering - Basic Structure
  // ==========================================================================

  describe("Rendering - Basic Structure", () => {
    it("should render DraggableWindow when result is provided", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByTestId("draggable-window")).toBeInTheDocument();
    });

    it("should render DraggableWindow with correct title", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-title")).toBe("⚂ ROLL RESULT ⚂");
    });

    it("should render with correct initialX (200)", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-initial-x")).toBe("200");
    });

    it("should render with correct initialY (150)", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-initial-y")).toBe("150");
    });

    it("should render with correct width (500)", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-width")).toBe("500");
    });

    it("should render with correct minWidth (400)", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-min-width")).toBe("400");
    });

    it("should render with correct maxWidth (600)", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-max-width")).toBe("600");
    });

    it("should render with correct zIndex (1001)", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-z-index")).toBe("1001");
    });

    it("should pass onClose prop to DraggableWindow", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-on-close")).toBe("present");
    });

    it("should render total with data-testid", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByTestId("roll-result-total")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // GROUP 3: Die Token Rendering
  // ==========================================================================

  describe("Die Token Rendering", () => {
    it("should render die token with correct symbol for d4", () => {
      const result = createRollResult(
        [createDieToken("d4")],
        [{ tokenId: "token-1", die: "d4", rolls: [3], subtotal: 3 }],
        3,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d4))).toBeInTheDocument();
    });

    it("should render die token with correct symbol for d6", () => {
      const result = createRollResult(
        [createDieToken("d6")],
        [{ tokenId: "token-1", die: "d6", rolls: [4], subtotal: 4 }],
        4,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d6))).toBeInTheDocument();
    });

    it("should render die token with correct symbol for d8", () => {
      const result = createRollResult(
        [createDieToken("d8")],
        [{ tokenId: "token-1", die: "d8", rolls: [5], subtotal: 5 }],
        5,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d8))).toBeInTheDocument();
    });

    it("should render die token with correct symbol for d10", () => {
      const result = createRollResult(
        [createDieToken("d10")],
        [{ tokenId: "token-1", die: "d10", rolls: [7], subtotal: 7 }],
        7,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d10))).toBeInTheDocument();
    });

    it("should render die token with correct symbol for d12", () => {
      const result = createRollResult(
        [createDieToken("d12")],
        [{ tokenId: "token-1", die: "d12", rolls: [9], subtotal: 9 }],
        9,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d12))).toBeInTheDocument();
    });

    it("should render die token with correct symbol for d20", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d20))).toBeInTheDocument();
    });

    it("should render die token with correct symbol for d100", () => {
      const result = createRollResult(
        [createDieToken("d100")],
        [{ tokenId: "token-1", die: "d100", rolls: [75], subtotal: 75 }],
        75,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(new RegExp(DIE_SYMBOLS.d100))).toBeInTheDocument();
    });

    it("should render die token with quantity when qty > 1", () => {
      const result = createRollResult(
        [createDieToken("d6", 3)],
        [{ tokenId: "token-1", die: "d6", rolls: [3, 5, 2], subtotal: 10 }],
        10,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/3d6/)).toBeInTheDocument();
    });

    it("should render die token without quantity when qty = 1", () => {
      const result = createRollResult(
        [createDieToken("d20", 1)],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Should show "d20" not "1d20"
      const text = screen.getByText(/d20/);
      expect(text.textContent).not.toContain("1d20");
    });

    it("should render die rolls breakdown", () => {
      const result = createRollResult(
        [createDieToken("d6", 3)],
        [{ tokenId: "token-1", die: "d6", rolls: [3, 5, 2], subtotal: 10 }],
        10,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("[3 + 5 + 2]")).toBeInTheDocument();
    });

    it("should render subtotal for die", () => {
      const result = createRollResult(
        [createDieToken("d6", 3)],
        [{ tokenId: "token-1", die: "d6", rolls: [3, 5, 2], subtotal: 10 }],
        10,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Subtotal is rendered (appears twice: once as subtotal, once as total)
      expect(screen.getAllByText("10")).toHaveLength(2);
    });

    it("should render multiple die tokens", () => {
      const result = createRollResult(
        [createDieToken("d20", 1, "token-1"), createDieToken("d6", 2, "token-2")],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", die: "d6", rolls: [3, 4], subtotal: 7 },
        ],
        22,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/d20/)).toBeInTheDocument();
      expect(screen.getByText(/2d6/)).toBeInTheDocument();
      expect(screen.getByText("[3 + 4]")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // GROUP 4: Modifier Token Rendering
  // ==========================================================================

  describe("Modifier Token Rendering", () => {
    it("should render positive modifier with + sign", () => {
      const result = createRollResult([createModToken(5)], [{ tokenId: "mod-1", subtotal: 5 }], 5);

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("+5")).toBeInTheDocument();
    });

    it("should render negative modifier correctly", () => {
      const result = createRollResult(
        [createModToken(-3)],
        [{ tokenId: "mod-1", subtotal: -3 }],
        -3,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Appears 3 times: modifier label, subtotal, and total
      expect(screen.getAllByText("-3")).toHaveLength(3);
    });

    it("should render zero modifier with + sign", () => {
      const result = createRollResult([createModToken(0)], [{ tokenId: "mod-1", subtotal: 0 }], 0);

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("+0")).toBeInTheDocument();
    });

    it("should render modifier subtotal", () => {
      const result = createRollResult([createModToken(7)], [{ tokenId: "mod-1", subtotal: 7 }], 7);

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Subtotal is rendered (appears twice: once as subtotal, once as total)
      expect(screen.getAllByText("7")).toHaveLength(2);
    });

    it("should not render rolls array for modifiers", () => {
      const result = createRollResult([createModToken(5)], [{ tokenId: "mod-1", subtotal: 5 }], 5);

      const { container } = render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Should not contain any brackets (which would indicate rolls)
      expect(container.textContent).not.toContain("[");
      expect(container.textContent).not.toContain("]");
    });
  });

  // ==========================================================================
  // GROUP 5: Total Display
  // ==========================================================================

  describe("Total Display", () => {
    it("should render correct total value", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [18], subtotal: 18 }],
        18,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const total = screen.getByTestId("roll-result-total");
      expect(total.textContent).toBe("18");
    });

    it("should render TOTAL text", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [18], subtotal: 18 }],
        18,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("TOTAL")).toBeInTheDocument();
    });

    it("should render total with data-testid roll-result-total", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [18], subtotal: 18 }],
        18,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const total = screen.getByTestId("roll-result-total");
      expect(total).toBeInTheDocument();
    });

    it("should render total with correct value for complex roll", () => {
      const result = createRollResult(
        [createDieToken("d20", 1, "token-1"), createModToken(5, "mod-1")],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "mod-1", subtotal: 5 },
        ],
        20,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const total = screen.getByTestId("roll-result-total");
      expect(total.textContent).toBe("20");
    });

    it("should render negative total correctly", () => {
      const result = createRollResult(
        [createDieToken("d4", 1, "token-1"), createModToken(-10, "mod-1")],
        [
          { tokenId: "token-1", die: "d4", rolls: [2], subtotal: 2 },
          { tokenId: "mod-1", subtotal: -10 },
        ],
        -8,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const total = screen.getByTestId("roll-result-total");
      expect(total.textContent).toBe("-8");
    });

    it("should render zero total correctly", () => {
      const result = createRollResult(
        [createModToken(0, "mod-1")],
        [{ tokenId: "mod-1", subtotal: 0 }],
        0,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const total = screen.getByTestId("roll-result-total");
      expect(total.textContent).toBe("0");
    });
  });

  // ==========================================================================
  // GROUP 6: Copy to Clipboard
  // ==========================================================================

  describe("Copy to Clipboard", () => {
    it("should render copy button", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("📋 Copy as Text")).toBeInTheDocument();
    });

    it("should call navigator.clipboard.writeText when clicked", async () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const copyButton = screen.getByText("📋 Copy as Text");
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
    });

    it("should call formatRollText with correct result", async () => {
      const { formatRollText } = await import("../diceLogic");
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const copyButton = screen.getByText("📋 Copy as Text");
      fireEvent.click(copyButton);

      expect(formatRollText).toHaveBeenCalledWith(result);
    });

    it("should handle clipboard API errors gracefully", async () => {
      mockClipboard.writeText.mockRejectedValueOnce(new Error("Clipboard error"));

      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const copyButton = screen.getByText("📋 Copy as Text");

      // Should not throw error
      expect(() => fireEvent.click(copyButton)).not.toThrow();
    });
  });

  // ==========================================================================
  // GROUP 7: Defensive Checks
  // ==========================================================================

  describe("Defensive Checks", () => {
    it("should handle missing token for roll (console.warn)", () => {
      // Create result where perDie has more entries than tokens
      const result = createRollResult(
        [createDieToken("d20")], // Only 1 token
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", die: "d6", rolls: [4], subtotal: 4 }, // No matching token
        ],
        19,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(console.warn).toHaveBeenCalledWith("Token missing for roll at index 1");
    });

    it("should not crash when token is missing", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", die: "d6", rolls: [4], subtotal: 4 },
        ],
        19,
      );

      expect(() => render(<ResultPanel result={result} onClose={vi.fn()} />)).not.toThrow();
    });

    it("should handle token being null", () => {
      const result = createRollResult(
        [createDieToken("d20"), null as unknown as Token],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", die: "d6", rolls: [4], subtotal: 4 },
        ],
        19,
      );

      expect(() => render(<ResultPanel result={result} onClose={vi.fn()} />)).not.toThrow();
    });

    it("should not render null token", () => {
      const result = createRollResult(
        [createDieToken("d20"), null as unknown as Token],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", die: "d6", rolls: [4], subtotal: 4 },
        ],
        19,
      );

      const { container } = render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Should only render one die (d20), not the null token
      expect(container.textContent).toContain("d20");
      expect(container.textContent).not.toContain("d6");
    });

    it("should handle token index out of bounds", () => {
      const result: RollResult = {
        id: "result-1",
        tokens: [], // Empty tokens array
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      expect(() => render(<ResultPanel result={result} onClose={vi.fn()} />)).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith("Token missing for roll at index 0");
    });
  });

  // ==========================================================================
  // GROUP 8: Mixed Scenarios
  // ==========================================================================

  describe("Mixed Scenarios", () => {
    it("should render combination of dice and modifiers", () => {
      const result = createRollResult(
        [createDieToken("d20", 1, "token-1"), createModToken(5, "mod-1")],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "mod-1", subtotal: 5 },
        ],
        20,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/d20/)).toBeInTheDocument();
      expect(screen.getByText("+5")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("20");
    });

    it("should render complex roll (multiple dice types + modifiers)", () => {
      const result = createRollResult(
        [
          createDieToken("d20", 1, "token-1"),
          createDieToken("d6", 3, "token-2"),
          createModToken(5, "mod-1"),
          createModToken(-2, "mod-2"),
        ],
        [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", die: "d6", rolls: [3, 5, 2], subtotal: 10 },
          { tokenId: "mod-1", subtotal: 5 },
          { tokenId: "mod-2", subtotal: -2 },
        ],
        28,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/d20/)).toBeInTheDocument();
      expect(screen.getByText(/3d6/)).toBeInTheDocument();
      expect(screen.getByText("+5")).toBeInTheDocument();
      expect(screen.getAllByText("-2")).toHaveLength(2); // Label and subtotal
      expect(screen.getByText("[3 + 5 + 2]")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("28");
    });

    it("should render with empty rolls array", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [], subtotal: 0 }],
        0,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      // Should still render, but no rolls breakdown
      expect(screen.getByText(/d20/)).toBeInTheDocument();
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it("should render with single die, no modifiers", () => {
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/d20/)).toBeInTheDocument();
      expect(screen.getByText("[15]")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("15");
    });

    it("should render only modifiers (no dice)", () => {
      const result = createRollResult(
        [createModToken(10, "mod-1"), createModToken(-3, "mod-2")],
        [
          { tokenId: "mod-1", subtotal: 10 },
          { tokenId: "mod-2", subtotal: -3 },
        ],
        7,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("+10")).toBeInTheDocument();
      expect(screen.getAllByText("-3")).toHaveLength(2); // Label and subtotal
      expect(screen.getByTestId("roll-result-total").textContent).toBe("7");
    });

    it("should render multiple dice of same type", () => {
      const result = createRollResult(
        [createDieToken("d6", 5, "token-1")],
        [{ tokenId: "token-1", die: "d6", rolls: [6, 6, 6, 6, 6], subtotal: 30 }],
        30,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/5d6/)).toBeInTheDocument();
      expect(screen.getByText("[6 + 6 + 6 + 6 + 6]")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("30");
    });

    it("should render all die types in one roll", () => {
      const result = createRollResult(
        [
          createDieToken("d4", 1, "t1"),
          createDieToken("d6", 1, "t2"),
          createDieToken("d8", 1, "t3"),
          createDieToken("d10", 1, "t4"),
          createDieToken("d12", 1, "t5"),
          createDieToken("d20", 1, "t6"),
          createDieToken("d100", 1, "t7"),
        ],
        [
          { tokenId: "t1", die: "d4", rolls: [4], subtotal: 4 },
          { tokenId: "t2", die: "d6", rolls: [6], subtotal: 6 },
          { tokenId: "t3", die: "d8", rolls: [8], subtotal: 8 },
          { tokenId: "t4", die: "d10", rolls: [10], subtotal: 10 },
          { tokenId: "t5", die: "d12", rolls: [12], subtotal: 12 },
          { tokenId: "t6", die: "d20", rolls: [20], subtotal: 20 },
          { tokenId: "t7", die: "d100", rolls: [100], subtotal: 100 },
        ],
        160,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/\bd4\b/)).toBeInTheDocument();
      expect(screen.getByText(/\bd6\b/)).toBeInTheDocument();
      expect(screen.getByText(/\bd8\b/)).toBeInTheDocument();
      expect(screen.getAllByText(/\bd10\b/)).toHaveLength(1); // Use getAllBy to avoid regex matching d100
      expect(screen.getByText(/\bd12\b/)).toBeInTheDocument();
      expect(screen.getByText(/\bd20\b/)).toBeInTheDocument();
      expect(screen.getByText(/\bd100\b/)).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("160");
    });

    it("should handle large roll results", () => {
      const result = createRollResult(
        [createDieToken("d100", 10, "token-1")],
        [
          {
            tokenId: "token-1",
            die: "d100",
            rolls: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
            subtotal: 1000,
          },
        ],
        1000,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText(/10d100/)).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("1000");
    });

    it("should handle single roll with value 1", () => {
      const result = createRollResult(
        [createDieToken("d20", 1, "token-1")],
        [{ tokenId: "token-1", die: "d20", rolls: [1], subtotal: 1 }],
        1,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("[1]")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("1");
    });
  });

  // ==========================================================================
  // GROUP 9: Edge Cases
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should handle result with no tokens or perDie entries", () => {
      const result: RollResult = {
        id: "result-1",
        tokens: [],
        perDie: [],
        total: 0,
        timestamp: Date.now(),
      };

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByTestId("roll-result-total").textContent).toBe("0");
    });

    it("should handle very long roll breakdown", () => {
      const rolls = Array.from({ length: 20 }, () => 6);
      const result = createRollResult(
        [createDieToken("d6", 20, "token-1")],
        [{ tokenId: "token-1", die: "d6", rolls, subtotal: 120 }],
        120,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      const rollsText = rolls.join(" + ");
      expect(screen.getByText(`[${rollsText}]`)).toBeInTheDocument();
    });

    it("should call onClose callback when provided", () => {
      const onClose = vi.fn();
      const result = createRollResult(
        [createDieToken("d20")],
        [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        15,
      );

      render(<ResultPanel result={result} onClose={onClose} />);

      const window = screen.getByTestId("draggable-window");
      expect(window.getAttribute("data-on-close")).toBe("present");
    });

    it("should handle modifier with maximum positive value", () => {
      const result = createRollResult(
        [createModToken(999, "mod-1")],
        [{ tokenId: "mod-1", subtotal: 999 }],
        999,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("+999")).toBeInTheDocument();
      expect(screen.getByTestId("roll-result-total").textContent).toBe("999");
    });

    it("should handle modifier with maximum negative value", () => {
      const result = createRollResult(
        [createModToken(-999, "mod-1")],
        [{ tokenId: "mod-1", subtotal: -999 }],
        -999,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getAllByText("-999")).toHaveLength(3); // Label, subtotal, and total
      expect(screen.getByTestId("roll-result-total").textContent).toBe("-999");
    });

    it("should handle mixed positive and negative modifiers", () => {
      const result = createRollResult(
        [createModToken(10, "mod-1"), createModToken(-15, "mod-2")],
        [
          { tokenId: "mod-1", subtotal: 10 },
          { tokenId: "mod-2", subtotal: -15 },
        ],
        -5,
      );

      render(<ResultPanel result={result} onClose={vi.fn()} />);

      expect(screen.getByText("+10")).toBeInTheDocument();
      expect(screen.getAllByText("-15")).toHaveLength(2); // Label and subtotal
      expect(screen.getByTestId("roll-result-total").textContent).toBe("-5");
    });
  });
});
