// ============================================================================
// INITIATIVE MODAL COMPONENT TESTS
// ============================================================================
// Comprehensive tests following Phase 1 patterns with strict SRP and SoC

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { InitiativeModal } from "../InitiativeModal";
import type { Character } from "@shared";

// ============================================================================
// POLYFILLS FOR TEST ENVIRONMENT
// ============================================================================

// PointerEvent polyfill for jsdom
if (typeof PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public width: number;
    public height: number;
    public pressure: number;
    public tangentialPressure: number;
    public tiltX: number;
    public tiltY: number;
    public twist: number;
    public pointerType: string;
    public isPrimary: boolean;

    constructor(type: string, params: any = {}) {
      // Pass all params to MouseEvent including clientX/clientY
      super(type, {
        bubbles: params.bubbles,
        cancelable: params.cancelable,
        composed: params.composed,
        view: params.view,
        detail: params.detail,
        screenX: params.screenX,
        screenY: params.screenY,
        clientX: params.clientX,
        clientY: params.clientY,
        ctrlKey: params.ctrlKey,
        shiftKey: params.shiftKey,
        altKey: params.altKey,
        metaKey: params.metaKey,
        button: params.button,
        buttons: params.buttons,
        relatedTarget: params.relatedTarget,
      });
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  (global as any).PointerEvent = PointerEventPolyfill;
}

// ============================================================================
// MOCKS
// ============================================================================

// Mock JRPGPanel and JRPGButton components
vi.mock("../../../../components/ui/JRPGPanel", () => ({
  JRPGPanel: ({
    title,
    children,
    style,
  }: {
    title: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <div data-testid="jrpg-panel" data-title={title} style={style}>
      <div data-testid="jrpg-panel-title">{title}</div>
      {children}
    </div>
  ),
  JRPGButton: ({
    children,
    onClick,
    disabled,
    variant,
    style,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    style?: React.CSSProperties;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      style={style}
    >
      {children}
    </button>
  ),
}));

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createMockCharacter(
  overrides: Partial<Character> = {},
): Character {
  return {
    id: "char-1",
    name: "Test Character",
    race: "Human",
    characterClass: "Fighter",
    level: 1,
    maxHp: 10,
    currentHp: 10,
    armorClass: 15,
    initiativeModifier: 2,
    ...overrides,
  } as Character;
}

function createDefaultProps(overrides: {
  character?: Character;
  onClose?: () => void;
  onSetInitiative?: (initiative: number, modifier: number) => void;
  isLoading?: boolean;
  error?: string | null;
} = {}) {
  return {
    character: createMockCharacter(),
    onClose: vi.fn(),
    onSetInitiative: vi.fn(),
    isLoading: false,
    error: null,
    ...overrides,
  };
}

// ============================================================================
// INITIAL RENDERING TESTS (SoC: Basic structure)
// ============================================================================

describe("InitiativeModal - Initial Rendering", () => {
  it("renders modal overlay", () => {
    const props = createDefaultProps();
    const { container } = render(<InitiativeModal {...props} />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toBeInTheDocument();
    expect(overlay.tagName).toBe("DIV");
    expect(overlay.style.position).toBe("fixed");
    expect(overlay.style.top).toBe("0px");
    expect(overlay.style.left).toBe("0px");
    expect(overlay.style.right).toBe("0px");
    expect(overlay.style.bottom).toBe("0px");
    expect(overlay.style.zIndex).toBe("10000");
  });

  it("displays character name in title", () => {
    const character = createMockCharacter({ name: "Aragorn" });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByTestId("jrpg-panel-title")).toHaveTextContent(
      "Initiative: Aragorn",
    );
  });

  it("shows modifier from character", () => {
    const character = createMockCharacter({ initiativeModifier: 5 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+5");
    expect(modifierDisplay).toBeInTheDocument();
  });

  it("shows modifier 0 when character.initiativeModifier is undefined", () => {
    const character = createMockCharacter({ initiativeModifier: undefined });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    expect(modifierDisplay).toBeInTheDocument();
  });

  it("shows 'Roll Initiative' button", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    expect(rollButton).toBeInTheDocument();
    expect(rollButton).toHaveAttribute("data-variant", "primary");
  });

  it("shows 'Use Physical Dice' button", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    expect(manualButton).toBeInTheDocument();
  });

  it("save button is disabled initially (no roll yet)", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("cancel button is enabled", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).not.toBeDisabled();
  });

  it("does not show manual entry input initially", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    expect(
      screen.queryByPlaceholderText("Enter roll..."),
    ).not.toBeInTheDocument();
  });

  it("does not show result display initially", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    // Check for the specific "Initiative: " text with a number following, not the title
    expect(screen.queryByText(/Initiative: \d+/)).not.toBeInTheDocument();
  });

  it("does not show error display initially", () => {
    const props = createDefaultProps();
    const { container } = render(<InitiativeModal {...props} />);

    const errorBoxes = container.querySelectorAll(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBoxes).toHaveLength(0);
  });
});

// ============================================================================
// MODIFIER STATE TESTS (SoC: Modifier management)
// ============================================================================

describe("InitiativeModal - Modifier State", () => {
  it("displays modifier with + prefix for positive value", () => {
    const character = createMockCharacter({ initiativeModifier: 3 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("displays modifier with + prefix for zero", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("+0")).toBeInTheDocument();
  });

  it("displays modifier without + for negative value", () => {
    const character = createMockCharacter({ initiativeModifier: -2 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("-2")).toBeInTheDocument();
  });

  it("green color for positive modifier", () => {
    const character = createMockCharacter({ initiativeModifier: 4 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+4");
    expect(modifierDisplay.style.color).toBe("var(--jrpg-green)");
  });

  it("green color for zero modifier", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    expect(modifierDisplay.style.color).toBe("var(--jrpg-green)");
  });

  it("red color for negative modifier", () => {
    const character = createMockCharacter({ initiativeModifier: -3 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("-3");
    expect(modifierDisplay.style.color).toBe("var(--jrpg-red)");
  });

  it("shows 'Click and drag left/right' hint text", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    expect(
      screen.getByText("Click and drag left/right to adjust"),
    ).toBeInTheDocument();
  });

  it("modifier display has correct styling", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+2");
    expect(modifierDisplay.style.fontSize).toBe("24px");
    expect(modifierDisplay.style.fontWeight).toBe("bold");
    expect(modifierDisplay.style.cursor).toBe("ew-resize");
    expect(modifierDisplay.style.userSelect).toBe("none");
  });
});

// ============================================================================
// MODIFIER DRAG INTERACTION TESTS (SoC: Pointer events)
// ============================================================================

describe("InitiativeModal - Modifier Drag Interaction", () => {
  let mockSetPointerCapture: ReturnType<typeof vi.fn>;
  let mockReleasePointerCapture: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetPointerCapture = vi.fn();
    mockReleasePointerCapture = vi.fn();

    HTMLElement.prototype.setPointerCapture = mockSetPointerCapture;
    HTMLElement.prototype.releasePointerCapture = mockReleasePointerCapture;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("onPointerDown initiates drag", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    expect(mockSetPointerCapture).toHaveBeenCalled();
  });

  it("moving right increases modifier (10px = +1)", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    // Create and dispatch a native PointerEvent for move
    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 110, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("moving left decreases modifier (10px = -1)", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 90, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("multiple 10px increments increase modifier correctly", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 130, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+3")).toBeInTheDocument();
  });

  it("partial 10px movement does not change modifier", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 109, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+0")).toBeInTheDocument();
  });

  it("clamped to -20 minimum", () => {
    const character = createMockCharacter({ initiativeModifier: -15 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("-15");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 0, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("-20")).toBeInTheDocument();
  });

  it("clamped to +20 maximum", () => {
    const character = createMockCharacter({ initiativeModifier: 15 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+15");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 200, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+20")).toBeInTheDocument();
  });

  it("releases pointer capture on pointerup", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });
    fireEvent.pointerMove(document, { clientX: 110 });
    fireEvent.pointerUp(document);

    expect(mockReleasePointerCapture).toHaveBeenCalled();
  });

  it("removes event listeners on pointerup", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });
    fireEvent.pointerUp(document);

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "pointerup",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });

  it("drag starting from positive modifier works correctly", () => {
    const character = createMockCharacter({ initiativeModifier: 5 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+5");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 120, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+7")).toBeInTheDocument();
  });

  it("drag starting from negative modifier works correctly", () => {
    const character = createMockCharacter({ initiativeModifier: -5 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("-5");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 80, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("-7")).toBeInTheDocument();
  });

  it("moving across zero changes sign correctly", () => {
    const character = createMockCharacter({ initiativeModifier: 1 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+1");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 80, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("does not exceed maximum when dragging from high value", () => {
    const character = createMockCharacter({ initiativeModifier: 19 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+19");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 150, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+20")).toBeInTheDocument();
  });

  it("does not exceed minimum when dragging from low value", () => {
    const character = createMockCharacter({ initiativeModifier: -19 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("-19");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 50, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("-20")).toBeInTheDocument();
  });
});

// ============================================================================
// ROLL INITIATIVE TESTS (SoC: Dice rolling)
// ============================================================================

describe("InitiativeModal - Roll Initiative", () => {
  let originalMathRandom: () => number;

  beforeEach(() => {
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalMathRandom;
  });

  it("clicking 'Roll Initiative' sets rolledValue (1-20)", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText(/d20 Roll: 11/)).toBeInTheDocument();
  });

  it("roll uses minimum value 1", () => {
    Math.random = () => 0; // Returns 1
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText(/d20 Roll: 1/)).toBeInTheDocument();
  });

  it("roll uses maximum value 20", () => {
    Math.random = () => 0.9999; // Returns 20
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText(/d20 Roll: 20/)).toBeInTheDocument();
  });

  it("clears manual mode when rolling", () => {
    Math.random = () => 0.5;
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    // Enter manual mode first
    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);
    expect(screen.getByPlaceholderText("Enter roll...")).toBeInTheDocument();

    // Roll initiative
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(
      screen.queryByPlaceholderText("Enter roll..."),
    ).not.toBeInTheDocument();
  });

  it("clears manual value when rolling", () => {
    Math.random = () => 0.5;
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    // Enter manual mode and type a value
    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);
    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "15" } });

    // Roll initiative
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    // Manual value should be cleared (input not visible)
    expect(
      screen.queryByPlaceholderText("Enter roll..."),
    ).not.toBeInTheDocument();
  });

  it("multiple rolls update value", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    Math.random = () => 0.3; // Returns 7
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText(/d20 Roll: 7/)).toBeInTheDocument();

    Math.random = () => 0.8; // Returns 17
    fireEvent.click(rollButton);
    expect(screen.getByText(/d20 Roll: 17/)).toBeInTheDocument();
  });

  it("roll result shows in result display", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 3 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("d20 Roll: 11 + 3")).toBeInTheDocument();
  });

  it("uses Math.random() internally", () => {
    const mockRandom = vi.fn(() => 0.5);
    Math.random = mockRandom;

    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(mockRandom).toHaveBeenCalled();
  });
});

// ============================================================================
// MANUAL ENTRY MODE TESTS (SoC: Physical dice input)
// ============================================================================

describe("InitiativeModal - Manual Entry Mode", () => {
  it("clicking 'Use Physical Dice' enables manual mode", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    expect(screen.getByPlaceholderText("Enter roll...")).toBeInTheDocument();
  });

  it("shows input field when manualMode=true", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("input has autoFocus", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...") as HTMLInputElement;
    // React's autoFocus prop causes the element to be focused after mounting
    // In jsdom, we verify the input exists and can receive focus
    expect(input).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  it("input has correct attributes", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "20");
  });

  it("accepts valid input value 1", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "1" } });

    expect(screen.getByText(/d20 Roll: 1/)).toBeInTheDocument();
  });

  it("accepts valid input value 20", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "20" } });

    expect(screen.getByText(/d20 Roll: 20/)).toBeInTheDocument();
  });

  it("accepts valid input value in middle range", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "10" } });

    expect(screen.getByText(/d20 Roll: 10/)).toBeInTheDocument();
  });

  it("sets rolledValue=null for invalid input 0", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "0" } });

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("sets rolledValue=null for invalid input 21", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "21" } });

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("sets rolledValue=null for NaN input", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "abc" } });

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("sets rolledValue=null for negative input", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "-5" } });

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("clears rolledValue when entering manual mode", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    // Roll first
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText(/d20 Roll: 11/)).toBeInTheDocument();

    // Enter manual mode
    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
  });

  it("shows label 'Enter d20 Roll (1-20)'", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    expect(screen.getByText("Enter d20 Roll (1-20)")).toBeInTheDocument();
  });

  it("input value updates when typing", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText(
      "Enter roll...",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15" } });

    expect(input.value).toBe("15");
  });

  it("empty input does not set rolledValue", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "" } });

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });
});

// ============================================================================
// FINAL INITIATIVE CALCULATION TESTS (SoC: Result computation)
// ============================================================================

describe("InitiativeModal - Final Initiative Calculation", () => {
  let originalMathRandom: () => number;

  beforeEach(() => {
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalMathRandom;
  });

  it("finalInitiative = rolledValue + modifier when roll exists", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 3 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("Initiative: 14")).toBeInTheDocument();
  });

  it("finalInitiative = null when no roll", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("updates when modifier changes", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 11")).toBeInTheDocument();

    // Drag modifier +2
    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 120, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("Initiative: 13")).toBeInTheDocument();
  });

  it("updates when rolledValue changes", () => {
    const character = createMockCharacter({ initiativeModifier: 2 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    Math.random = () => 0.5; // Returns 11
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 13")).toBeInTheDocument();

    Math.random = () => 0.9; // Returns 19
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 21")).toBeInTheDocument();
  });

  it("calculation with positive modifier", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 5 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("Initiative: 16")).toBeInTheDocument();
  });

  it("calculation with negative modifier", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: -3 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("Initiative: 8")).toBeInTheDocument();
  });

  it("calculation with zero modifier", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("Initiative: 11")).toBeInTheDocument();
  });

  it("calculation with manual entry", () => {
    const character = createMockCharacter({ initiativeModifier: 4 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "15" } });

    expect(screen.getByText("Initiative: 19")).toBeInTheDocument();
  });

  it("negative final initiative is possible", () => {
    Math.random = () => 0; // Returns 1
    const character = createMockCharacter({ initiativeModifier: -5 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("Initiative: -4")).toBeInTheDocument();
  });
});

// ============================================================================
// RESULT DISPLAY TESTS (SoC: Visual feedback)
// ============================================================================

describe("InitiativeModal - Result Display", () => {
  let originalMathRandom: () => number;

  beforeEach(() => {
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalMathRandom;
  });

  it("shows result box when rolledValue !== null", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText(/d20 Roll:/)).toBeInTheDocument();
    // Use getAllByText and check we have at least one initiative result
    const initiativeTexts = screen.getAllByText(/Initiative:/);
    expect(initiativeTexts.length).toBeGreaterThan(0);
  });

  it("displays 'd20 Roll: X + Y' for positive modifier", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 3 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("d20 Roll: 11 + 3")).toBeInTheDocument();
  });

  it("displays 'd20 Roll: X - Y' for negative modifier (shows modifier value)", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: -2 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    // The component shows "11  -2" with two spaces (one from {modifier >= 0 ? "+" : ""} and one before the modifier)
    expect(screen.getByText(/d20 Roll: 11\s+-2/)).toBeInTheDocument();
  });

  it("displays 'd20 Roll: X + Y' for zero modifier", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("d20 Roll: 11 + 0")).toBeInTheDocument();
  });

  it("displays 'Initiative: Z' in large gold text", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 2 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const initiativeText = screen.getByText("Initiative: 13");
    expect(initiativeText).toBeInTheDocument();
    expect(initiativeText.style.fontSize).toBe("32px");
    expect(initiativeText.style.fontWeight).toBe("bold");
    expect(initiativeText.style.color).toBe("var(--jrpg-gold)");
  });

  it("hidden when no roll", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    // Check that there's no result display with a number (title is OK)
    expect(screen.queryByText(/Initiative: \d+/)).not.toBeInTheDocument();
  });

  it("hidden when invalid manual entry", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "25" } });

    expect(screen.queryByText(/d20 Roll:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Initiative: \d+/)).not.toBeInTheDocument();
  });

  it("result box has correct styling", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps();
    const { container } = render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const resultBox = container.querySelector(
      '[style*="rgba(255, 215, 0, 0.1)"]',
    );
    expect(resultBox).toBeInTheDocument();
  });

  it("updates display when modifier is dragged", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText("d20 Roll: 11 + 0")).toBeInTheDocument();

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 130, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("d20 Roll: 11 + 3")).toBeInTheDocument();
    expect(screen.getByText("Initiative: 14")).toBeInTheDocument();
  });
});

// ============================================================================
// SAVE FUNCTIONALITY TESTS (SoC: Data persistence)
// ============================================================================

describe("InitiativeModal - Save Functionality", () => {
  let originalMathRandom: () => number;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalMathRandom = Math.random;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    Math.random = originalMathRandom;
    consoleLogSpy.mockRestore();
  });

  it("calls onSetInitiative(finalInitiative, modifier) on save", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 3 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(onSetInitiative).toHaveBeenCalledWith(14, 3);
  });

  it("save button enabled when finalInitiative !== null", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();
  });

  it("save button disabled when finalInitiative === null", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("save button disabled when isLoading", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps({ isLoading: true });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: /Setting/ });
    expect(saveButton).toBeDisabled();
  });

  it("does NOT call onClose immediately after save", () => {
    Math.random = () => 0.5; // Returns 11
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows 'Setting...' text when isLoading", () => {
    const props = createDefaultProps({ isLoading: true });
    render(<InitiativeModal {...props} />);

    expect(screen.getByRole("button", { name: /Setting/ })).toBeInTheDocument();
  });

  it("shows 'Save' text when not loading", () => {
    const props = createDefaultProps({ isLoading: false });
    render(<InitiativeModal {...props} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls onSetInitiative with correct values after modifier drag", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 0 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 120, bubbles: true });
      document.dispatchEvent(moveEvent);
    });
    fireEvent.pointerUp(document);

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(onSetInitiative).toHaveBeenCalledWith(13, 2);
  });

  it("calls onSetInitiative with manual entry value", () => {
    const character = createMockCharacter({ initiativeModifier: 3 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);

    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "18" } });

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(onSetInitiative).toHaveBeenCalledWith(21, 3);
  });

  it("logs save action to console", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({
      name: "TestChar",
      initiativeModifier: 2,
    });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[InitiativeModal] Saving initiative:",
      {
        finalInitiative: 13,
        modifier: 2,
        character: "TestChar",
      },
    );
  });

  it("save button has success variant", () => {
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toHaveAttribute("data-variant", "success");
  });
});

// ============================================================================
// AUTO-CLOSE ON SUCCESS TESTS (SoC: Success flow)
// ============================================================================

describe("InitiativeModal - Auto-Close on Success", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("calls onClose when isLoading changes from true → false (and no error)", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: true, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(<InitiativeModal {...props} isLoading={false} />);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("does NOT close when isLoading changes to true", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: false, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(<InitiativeModal {...props} isLoading={true} />);

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it("does NOT close when error is present", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: true, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(
      <InitiativeModal {...props} isLoading={false} error="Test error" />,
    );

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it("tracks wasLoading state internally", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: false, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    // First render with isLoading=false should not close
    rerender(<InitiativeModal {...props} isLoading={false} />);

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it("does not close on initial render when isLoading=false", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: false, onClose });
    render(<InitiativeModal {...props} />);

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it("logs success message when closing", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: true, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(<InitiativeModal {...props} isLoading={false} />);

    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[InitiativeModal] Initiative set successfully, closing modal",
      );
    });
  });

  it("does not close when loading remains true", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: true, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(<InitiativeModal {...props} isLoading={true} />);

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it("does not close when error persists", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({
      isLoading: true,
      error: "Test error",
      onClose,
    });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(
      <InitiativeModal {...props} isLoading={false} error="Test error" />,
    );

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it("closes only when wasLoading=true and isLoading becomes false", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: false, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    // Set loading to true
    rerender(<InitiativeModal {...props} isLoading={true} />);
    expect(onClose).not.toHaveBeenCalled();

    // Then set loading to false - should close
    rerender(<InitiativeModal {...props} isLoading={false} />);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// ERROR DISPLAY TESTS (SoC: Error handling)
// ============================================================================

describe("InitiativeModal - Error Display", () => {
  it("shows error box when error prop is set", () => {
    const props = createDefaultProps({ error: "Failed to set initiative" });
    const { container } = render(<InitiativeModal {...props} />);

    const errorBox = container.querySelector(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBox).toBeInTheDocument();
  });

  it("displays error text in red", () => {
    const props = createDefaultProps({ error: "Network error occurred" });
    render(<InitiativeModal {...props} />);

    const errorText = screen.getByText("Network error occurred");
    expect(errorText).toBeInTheDocument();
    expect(errorText.style.color).toBe("var(--jrpg-red)");
  });

  it("hidden when error is null", () => {
    const props = createDefaultProps({ error: null });
    const { container } = render(<InitiativeModal {...props} />);

    const errorBoxes = container.querySelectorAll(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBoxes).toHaveLength(0);
  });

  it("hidden when error is undefined", () => {
    const props = createDefaultProps({ error: undefined });
    const { container } = render(<InitiativeModal {...props} />);

    const errorBoxes = container.querySelectorAll(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBoxes).toHaveLength(0);
  });

  it("error box has correct styling", () => {
    const props = createDefaultProps({ error: "Test error" });
    const { container } = render(<InitiativeModal {...props} />);

    const errorBox = container.querySelector(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBox).toHaveAttribute(
      "style",
      expect.stringContaining("border: 2px solid var(--jrpg-red)"),
    );
  });

  it("displays multiple error messages correctly", () => {
    const props = createDefaultProps({ error: "Error line 1" });
    const { rerender } = render(<InitiativeModal {...props} />);

    expect(screen.getByText("Error line 1")).toBeInTheDocument();

    rerender(<InitiativeModal {...props} error="Error line 2" />);

    expect(screen.getByText("Error line 2")).toBeInTheDocument();
    expect(screen.queryByText("Error line 1")).not.toBeInTheDocument();
  });

  it("error text is centered", () => {
    const props = createDefaultProps({ error: "Centered error" });
    const { container } = render(<InitiativeModal {...props} />);

    const errorBox = container.querySelector(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBox).toHaveAttribute(
      "style",
      expect.stringContaining("text-align: center"),
    );
  });

  it("shows error and result display simultaneously", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps({ error: "Test warning" });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText("Test warning")).toBeInTheDocument();
    expect(screen.getByText(/d20 Roll:/)).toBeInTheDocument();
  });
});

// ============================================================================
// KEYBOARD SHORTCUTS TESTS (SoC: Keyboard interaction)
// ============================================================================

describe("InitiativeModal - Keyboard Shortcuts", () => {
  let originalMathRandom: () => number;

  beforeEach(() => {
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalMathRandom;
  });

  it("Escape key calls onClose (when not loading)", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose, isLoading: false });
    render(<InitiativeModal {...props} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("Enter key calls handleSave (when finalInitiative !== null and not loading)", () => {
    Math.random = () => 0.5; // Returns 11
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onSetInitiative, isLoading: false });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSetInitiative).toHaveBeenCalled();
  });

  it("no action when isLoading=true and Escape pressed", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose, isLoading: true });
    render(<InitiativeModal {...props} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("no action when isLoading=true and Enter pressed", () => {
    Math.random = () => 0.5; // Returns 11
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onSetInitiative, isLoading: true });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("Enter does nothing when finalInitiative === null", () => {
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onSetInitiative, isLoading: false });
    render(<InitiativeModal {...props} />);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("adds event listeners properly", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const props = createDefaultProps();
    render(<InitiativeModal {...props} />);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );

    addEventListenerSpy.mockRestore();
  });

  it("removes event listeners on cleanup", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    const props = createDefaultProps();
    const { unmount } = render(<InitiativeModal {...props} />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });

  it("other keys do not trigger actions", () => {
    const onClose = vi.fn();
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onClose, onSetInitiative });
    render(<InitiativeModal {...props} />);

    fireEvent.keyDown(document, { key: "a" });
    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "Space" });

    expect(onClose).not.toHaveBeenCalled();
    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("Escape works even when finalInitiative is set", () => {
    Math.random = () => 0.5; // Returns 11
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("Enter saves with correct final initiative value", () => {
    Math.random = () => 0.8; // Returns 17
    const character = createMockCharacter({ initiativeModifier: 5 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSetInitiative).toHaveBeenCalledWith(22, 5);
  });
});

// ============================================================================
// MODAL BACKDROP TESTS (SoC: Modal interaction)
// ============================================================================

describe("InitiativeModal - Modal Backdrop", () => {
  it("clicking backdrop calls onClose", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    const { container } = render(<InitiativeModal {...props} />);

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("clicking modal content does NOT call onClose (stopPropagation)", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<InitiativeModal {...props} />);

    const panel = screen.getByTestId("jrpg-panel");
    fireEvent.click(panel);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking inside panel content does not close modal", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<InitiativeModal {...props} />);

    const modifierLabel = screen.getByText("Initiative Modifier");
    fireEvent.click(modifierLabel);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking buttons does not close modal via backdrop", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    // onClose should not be called from backdrop
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop has correct styling", () => {
    const props = createDefaultProps();
    const { container } = render(<InitiativeModal {...props} />);

    const backdrop = container.firstChild as HTMLElement;
    expect(backdrop.style.background).toBe("rgba(0, 0, 0, 0.8)");
    expect(backdrop.style.display).toBe("flex");
    expect(backdrop.style.alignItems).toBe("center");
    expect(backdrop.style.justifyContent).toBe("center");
  });

  it("clicking different areas of backdrop all call onClose", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    const { container } = render(<InitiativeModal {...props} />);

    const backdrop = container.firstChild as HTMLElement;

    // Click multiple times to simulate different areas
    fireEvent.click(backdrop);
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// LOADING STATE TESTS (SoC: Async operations)
// ============================================================================

describe("InitiativeModal - Loading State", () => {
  let originalMathRandom: () => number;

  beforeEach(() => {
    originalMathRandom = Math.random;
  });

  afterEach(() => {
    Math.random = originalMathRandom;
  });

  it("isLoading=true disables Cancel button", () => {
    const props = createDefaultProps({ isLoading: true });
    render(<InitiativeModal {...props} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeDisabled();
  });

  it("isLoading=true disables Save button", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps({ isLoading: true });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: /Setting/ });
    expect(saveButton).toBeDisabled();
  });

  it("isLoading=true shows 'Setting...' text", () => {
    const props = createDefaultProps({ isLoading: true });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("Setting...")).toBeInTheDocument();
  });

  it("isLoading=true prevents keyboard shortcuts", () => {
    Math.random = () => 0.5; // Returns 11
    const onClose = vi.fn();
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onClose, onSetInitiative, isLoading: true });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Enter" });

    expect(onClose).not.toHaveBeenCalled();
    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("isLoading=false enables Cancel button", () => {
    const props = createDefaultProps({ isLoading: false });
    render(<InitiativeModal {...props} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).not.toBeDisabled();
  });

  it("isLoading=false shows 'Save' text", () => {
    const props = createDefaultProps({ isLoading: false });
    render(<InitiativeModal {...props} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("isLoading=false allows keyboard shortcuts", () => {
    Math.random = () => 0.5; // Returns 11
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onSetInitiative, isLoading: false });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSetInitiative).toHaveBeenCalled();
  });

  it("loading state transitions correctly", () => {
    const props = createDefaultProps({ isLoading: false });
    const { rerender } = render(<InitiativeModal {...props} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).not.toBeDisabled();

    rerender(<InitiativeModal {...props} isLoading={true} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByText("Setting...")).toBeInTheDocument();
  });

  it("roll and manual entry still work when loading", () => {
    Math.random = () => 0.5; // Returns 11
    const props = createDefaultProps({ isLoading: true });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    expect(screen.getByText(/d20 Roll: 11/)).toBeInTheDocument();
  });

  it("modifier drag still works when loading", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character, isLoading: true });
    render(<InitiativeModal {...props} />);

    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 120, bubbles: true });
      document.dispatchEvent(moveEvent);
    });

    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});

// ============================================================================
// PROPS VALIDATION TESTS (SoC: Props handling)
// ============================================================================

describe("InitiativeModal - Props Validation", () => {
  it("required prop: character", () => {
    const character = createMockCharacter({ name: "TestChar" });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(
      screen.getByTestId("jrpg-panel-title"),
    ).toHaveTextContent("Initiative: TestChar");
  });

  it("required prop: onClose", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<InitiativeModal {...props} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("required prop: onSetInitiative", () => {
    Math.random = () => 0.5; // Returns 11
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    expect(onSetInitiative).toHaveBeenCalled();
  });

  it("optional prop: isLoading (default: false)", () => {
    const props = createDefaultProps();
    // Not passing isLoading explicitly
    render(<InitiativeModal {...props} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("optional prop: error (default: null)", () => {
    const props = createDefaultProps();
    // Not passing error explicitly
    const { container } = render(<InitiativeModal {...props} />);

    const errorBoxes = container.querySelectorAll(
      '[style*="rgba(255, 0, 0, 0.1)"]',
    );
    expect(errorBoxes).toHaveLength(0);
  });

  it("character.initiativeModifier can be undefined (defaults to 0)", () => {
    const character = createMockCharacter({ initiativeModifier: undefined });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("+0")).toBeInTheDocument();
  });

  it("character.initiativeModifier can be positive", () => {
    const character = createMockCharacter({ initiativeModifier: 7 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("+7")).toBeInTheDocument();
  });

  it("character.initiativeModifier can be negative", () => {
    const character = createMockCharacter({ initiativeModifier: -4 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("-4")).toBeInTheDocument();
  });

  it("character.initiativeModifier can be zero", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(screen.getByText("+0")).toBeInTheDocument();
  });

  it("character with different name", () => {
    const character = createMockCharacter({ name: "Different Name" });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(
      screen.getByTestId("jrpg-panel-title"),
    ).toHaveTextContent("Initiative: Different Name");
  });

  it("handles character with all properties", () => {
    const character = createMockCharacter({
      id: "test-id",
      name: "Full Character",
      race: "Elf",
      characterClass: "Wizard",
      level: 5,
      maxHp: 30,
      currentHp: 25,
      armorClass: 14,
      initiativeModifier: 3,
    });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    expect(
      screen.getByTestId("jrpg-panel-title"),
    ).toHaveTextContent("Initiative: Full Character");
    expect(screen.getByText("+3")).toBeInTheDocument();
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("InitiativeModal - Integration Tests", () => {
  let originalMathRandom: () => number;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalMathRandom = Math.random;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    Math.random = originalMathRandom;
    consoleLogSpy.mockRestore();
  });

  it("complete flow: roll → adjust modifier → save", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 2 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    // Roll
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 13")).toBeInTheDocument();

    // Adjust modifier
    const modifierDisplay = screen.getByText("+2");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 130, bubbles: true });
      document.dispatchEvent(moveEvent);
    });
    fireEvent.pointerUp(document);
    expect(screen.getByText("Initiative: 16")).toBeInTheDocument();

    // Save
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);
    expect(onSetInitiative).toHaveBeenCalledWith(16, 5);
  });

  it("complete flow: manual entry → adjust modifier → save", () => {
    const character = createMockCharacter({ initiativeModifier: 1 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    // Manual entry
    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);
    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "15" } });
    expect(screen.getByText("Initiative: 16")).toBeInTheDocument();

    // Adjust modifier
    const modifierDisplay = screen.getByText("+1");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent = new PointerEvent("pointermove", { clientX: 80, bubbles: true });
      document.dispatchEvent(moveEvent);
    });
    fireEvent.pointerUp(document);
    // Moving from clientX 100 to 80 is -20px, which is -2 modifier change
    // +1 - 2 = -1, so 15 + (-1) = 14
    expect(screen.getByText("Initiative: 14")).toBeInTheDocument();

    // Save
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);
    expect(onSetInitiative).toHaveBeenCalledWith(14, -1);
  });

  it("complete flow: manual → roll → save (overwriting)", () => {
    Math.random = () => 0.8; // Returns 17
    const character = createMockCharacter({ initiativeModifier: 2 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    // Manual entry
    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);
    const input = screen.getByPlaceholderText("Enter roll...");
    fireEvent.change(input, { target: { value: "10" } });
    expect(screen.getByText("Initiative: 12")).toBeInTheDocument();

    // Roll (overwrites manual)
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 19")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Enter roll..."),
    ).not.toBeInTheDocument();

    // Save
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);
    expect(onSetInitiative).toHaveBeenCalledWith(19, 2);
  });

  it("cancel flow: roll → cancel", () => {
    Math.random = () => 0.5; // Returns 11
    const onClose = vi.fn();
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onClose, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("escape flow: roll → escape", () => {
    Math.random = () => 0.5; // Returns 11
    const onClose = vi.fn();
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ onClose, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("enter shortcut flow: roll → enter", () => {
    Math.random = () => 0.5; // Returns 11
    const character = createMockCharacter({ initiativeModifier: 3 });
    const onSetInitiative = vi.fn();
    const props = createDefaultProps({ character, onSetInitiative });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);

    fireEvent.keyDown(document, { key: "Enter" });

    expect(onSetInitiative).toHaveBeenCalledWith(14, 3);
  });

  it("loading → success → auto-close flow", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: true, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    expect(onClose).not.toHaveBeenCalled();

    rerender(<InitiativeModal {...props} isLoading={false} />);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("loading → error flow (no auto-close)", async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ isLoading: true, onClose });
    const { rerender } = render(<InitiativeModal {...props} />);

    rerender(
      <InitiativeModal {...props} isLoading={false} error="Test error" />,
    );

    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
    });
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("extreme modifier adjustment: drag to both limits", () => {
    const character = createMockCharacter({ initiativeModifier: 0 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    // Drag to max
    const modifierDisplay = screen.getByText("+0");
    fireEvent.pointerDown(modifierDisplay, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent1 = new PointerEvent("pointermove", { clientX: 500, bubbles: true });
      document.dispatchEvent(moveEvent1);
    });
    fireEvent.pointerUp(document);
    expect(screen.getByText("+20")).toBeInTheDocument();

    // Drag to min
    const modifierDisplayMax = screen.getByText("+20");
    fireEvent.pointerDown(modifierDisplayMax, { clientX: 100, pointerId: 1, bubbles: true });

    act(() => {
      const moveEvent2 = new PointerEvent("pointermove", { clientX: -500, bubbles: true });
      document.dispatchEvent(moveEvent2);
    });
    fireEvent.pointerUp(document);
    expect(screen.getByText("-20")).toBeInTheDocument();
  });

  it("multiple rolls with different results", () => {
    const character = createMockCharacter({ initiativeModifier: 2 });
    const props = createDefaultProps({ character });
    render(<InitiativeModal {...props} />);

    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });

    Math.random = () => 0; // Returns 1
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 3")).toBeInTheDocument();

    Math.random = () => 0.9999; // Returns 20
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 22")).toBeInTheDocument();

    Math.random = () => 0.5; // Returns 11
    fireEvent.click(rollButton);
    expect(screen.getByText("Initiative: 13")).toBeInTheDocument();
  });

  it("backdrop click during various states", () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    const { container } = render(<InitiativeModal {...props} />);

    const backdrop = container.firstChild as HTMLElement;

    // Initial state
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    // After roll
    Math.random = () => 0.5;
    const rollButton = screen.getByRole("button", {
      name: "Roll Initiative",
    });
    fireEvent.click(rollButton);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);

    // After manual mode
    const manualButton = screen.getByRole("button", {
      name: "Use Physical Dice",
    });
    fireEvent.click(manualButton);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
