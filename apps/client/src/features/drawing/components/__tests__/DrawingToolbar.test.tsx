/**
 * Component tests for DrawingToolbar
 *
 * Tests the draggable drawing toolbar component, including:
 * - Tool selection (freehand, line, rect, circle, eraser)
 * - Color selection (preset colors and custom color picker)
 * - Brush size control
 * - Opacity control
 * - Fill toggle for shapes
 * - Undo/Redo functionality
 * - Clear all functionality
 * - Conditional rendering based on tool selection
 * - DraggableWindow integration
 *
 * Source: apps/client/src/features/drawing/components/DrawingToolbar.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DrawingToolbar } from "../DrawingToolbar";
import type { DrawingToolbarProps } from "../DrawingToolbar";

// Mock DraggableWindow component
vi.mock("../../../../components/dice/DraggableWindow", () => ({
  DraggableWindow: ({
    title,
    onClose,
    children,
    initialX,
    initialY,
    width,
    storageKey,
    zIndex,
  }: {
    title: string;
    onClose?: () => void;
    children: React.ReactNode;
    initialX?: number;
    initialY?: number;
    width?: number;
    storageKey?: string;
    zIndex?: number;
  }) => (
    <div data-testid="draggable-window">
      <div data-testid="window-title">{title}</div>
      <div data-testid="window-initialX">{initialX}</div>
      <div data-testid="window-initialY">{initialY}</div>
      <div data-testid="window-width">{width}</div>
      <div data-testid="window-storageKey">{storageKey}</div>
      <div data-testid="window-zIndex">{zIndex}</div>
      {onClose && (
        <button data-testid="window-close" onClick={onClose}>
          Close
        </button>
      )}
      {children}
    </div>
  ),
}));

// Mock JRPGPanel and JRPGButton components
vi.mock("../../../../components/ui/JRPGPanel", () => ({
  JRPGPanel: ({
    children,
    variant,
    style,
  }: {
    children: React.ReactNode;
    variant?: string;
    style?: React.CSSProperties;
  }) => (
    <div data-testid="jrpg-panel" data-variant={variant} style={style}>
      {children}
    </div>
  ),
  JRPGButton: ({
    children,
    onClick,
    variant,
    disabled,
    style,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
  }) => (
    <button
      data-testid="jrpg-button"
      data-variant={variant}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  ),
}));

describe("DrawingToolbar", () => {
  const defaultProps: DrawingToolbarProps = {
    drawTool: "freehand",
    drawColor: "#ff0000",
    drawWidth: 5,
    drawOpacity: 1,
    drawFilled: false,
    onToolChange: vi.fn(),
    onColorChange: vi.fn(),
    onWidthChange: vi.fn(),
    onOpacityChange: vi.fn(),
    onFilledChange: vi.fn(),
    onClearAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GROUP 1: Initial Rendering
  // =========================================================================

  describe("Initial Rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      expect(container).toBeTruthy();
    });

    it("should render DraggableWindow with correct title", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByTestId("window-title")).toHaveTextContent("🎨 DRAWING TOOLS");
    });

    it("should render DraggableWindow with correct initialX", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByTestId("window-initialX")).toHaveTextContent("8");
    });

    it("should render DraggableWindow with correct initialY", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByTestId("window-initialY")).toHaveTextContent("100");
    });

    it("should render DraggableWindow with correct width", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByTestId("window-width")).toHaveTextContent("250");
    });

    it("should render DraggableWindow with correct storageKey", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByTestId("window-storageKey")).toHaveTextContent("drawing-toolbar");
    });

    it("should render DraggableWindow with correct zIndex", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByTestId("window-zIndex")).toHaveTextContent("200");
    });

    it("should render JRPGPanel with bevel variant", () => {
      render(<DrawingToolbar {...defaultProps} />);

      const panel = screen.getByTestId("jrpg-panel");
      expect(panel).toHaveAttribute("data-variant", "bevel");
    });

    it("should render close button when onClose provided", () => {
      render(<DrawingToolbar {...defaultProps} onClose={vi.fn()} />);

      expect(screen.getByTestId("window-close")).toBeInTheDocument();
    });

    it("should not render close button when onClose not provided", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.queryByTestId("window-close")).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // GROUP 2: Tool Selection
  // =========================================================================

  describe("Tool Selection", () => {
    it("should render all five tool buttons", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByText(/✏️ Draw/i)).toBeInTheDocument();
      expect(screen.getByText(/📏 Line/i)).toBeInTheDocument();
      expect(screen.getByText(/▭ Rect/i)).toBeInTheDocument();
      expect(screen.getByText(/⬤ Circle/i)).toBeInTheDocument();
      expect(screen.getByText(/🧹 Eraser/i)).toBeInTheDocument();
    });

    it("should highlight freehand tool when selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const freehandButton = buttons.find((btn) => btn.textContent?.includes("✏️ Draw"));

      expect(freehandButton).toHaveAttribute("data-variant", "primary");
    });

    it("should highlight line tool when selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="line" />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const lineButton = buttons.find((btn) => btn.textContent?.includes("📏 Line"));

      expect(lineButton).toHaveAttribute("data-variant", "primary");
    });

    it("should highlight rect tool when selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const rectButton = buttons.find((btn) => btn.textContent?.includes("▭ Rect"));

      expect(rectButton).toHaveAttribute("data-variant", "primary");
    });

    it("should highlight circle tool when selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="circle" />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const circleButton = buttons.find((btn) => btn.textContent?.includes("⬤ Circle"));

      expect(circleButton).toHaveAttribute("data-variant", "primary");
    });

    it("should highlight eraser tool when selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const eraserButton = buttons.find((btn) => btn.textContent?.includes("🧹 Eraser"));

      expect(eraserButton).toHaveAttribute("data-variant", "primary");
    });

    it("should show default variant for unselected tools", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const lineButton = buttons.find((btn) => btn.textContent?.includes("📏 Line"));
      const rectButton = buttons.find((btn) => btn.textContent?.includes("▭ Rect"));

      expect(lineButton).toHaveAttribute("data-variant", "default");
      expect(rectButton).toHaveAttribute("data-variant", "default");
    });

    it("should call onToolChange when freehand is clicked", () => {
      const onToolChange = vi.fn();
      render(<DrawingToolbar {...defaultProps} onToolChange={onToolChange} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const freehandButton = buttons.find((btn) => btn.textContent?.includes("✏️ Draw"));

      fireEvent.click(freehandButton!);

      expect(onToolChange).toHaveBeenCalledWith("freehand");
    });

    it("should call onToolChange when line is clicked", () => {
      const onToolChange = vi.fn();
      render(<DrawingToolbar {...defaultProps} onToolChange={onToolChange} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const lineButton = buttons.find((btn) => btn.textContent?.includes("📏 Line"));

      fireEvent.click(lineButton!);

      expect(onToolChange).toHaveBeenCalledWith("line");
    });

    it("should call onToolChange when rect is clicked", () => {
      const onToolChange = vi.fn();
      render(<DrawingToolbar {...defaultProps} onToolChange={onToolChange} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const rectButton = buttons.find((btn) => btn.textContent?.includes("▭ Rect"));

      fireEvent.click(rectButton!);

      expect(onToolChange).toHaveBeenCalledWith("rect");
    });

    it("should call onToolChange when circle is clicked", () => {
      const onToolChange = vi.fn();
      render(<DrawingToolbar {...defaultProps} onToolChange={onToolChange} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const circleButton = buttons.find((btn) => btn.textContent?.includes("⬤ Circle"));

      fireEvent.click(circleButton!);

      expect(onToolChange).toHaveBeenCalledWith("circle");
    });

    it("should call onToolChange when eraser is clicked", () => {
      const onToolChange = vi.fn();
      render(<DrawingToolbar {...defaultProps} onToolChange={onToolChange} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const eraserButton = buttons.find((btn) => btn.textContent?.includes("🧹 Eraser"));

      fireEvent.click(eraserButton!);

      expect(onToolChange).toHaveBeenCalledWith("eraser");
    });
  });

  // =========================================================================
  // GROUP 3: Color Selection
  // =========================================================================

  describe("Color Selection", () => {
    it("should render all 12 preset color buttons", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const colorButtons = container.querySelectorAll('button[title]');
      const presetColorButtons = Array.from(colorButtons).filter(
        (btn) => btn.getAttribute("title")?.startsWith("#") ?? false,
      );

      expect(presetColorButtons).toHaveLength(12);
    });

    it("should render white preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const whiteButton = container.querySelector('button[title="#ffffff"]');
      expect(whiteButton).toBeInTheDocument();
    });

    it("should render black preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const blackButton = container.querySelector('button[title="#000000"]');
      expect(blackButton).toBeInTheDocument();
    });

    it("should render red preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const redButton = container.querySelector('button[title="#ff0000"]');
      expect(redButton).toBeInTheDocument();
    });

    it("should render blue preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const blueButton = container.querySelector('button[title="#0000ff"]');
      expect(blueButton).toBeInTheDocument();
    });

    it("should render grey preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const greyButton = container.querySelector('button[title="#888888"]');
      expect(greyButton).toBeInTheDocument();
    });

    it("should render hero gold preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const goldButton = container.querySelector('button[title="#F0E2C3"]');
      expect(goldButton).toBeInTheDocument();
    });

    it("should render hero blue preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const heroBlueButton = container.querySelector('button[title="#447DF7"]');
      expect(heroBlueButton).toBeInTheDocument();
    });

    it("should render green preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const greenButton = container.querySelector('button[title="#66cc66"]');
      expect(greenButton).toBeInTheDocument();
    });

    it("should render yellow preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const yellowButton = container.querySelector('button[title="#ffff00"]');
      expect(yellowButton).toBeInTheDocument();
    });

    it("should render magenta preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const magentaButton = container.querySelector('button[title="#ff00ff"]');
      expect(magentaButton).toBeInTheDocument();
    });

    it("should render cyan preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const cyanButton = container.querySelector('button[title="#00ffff"]');
      expect(cyanButton).toBeInTheDocument();
    });

    it("should render orange preset color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const orangeButton = container.querySelector('button[title="#ff8800"]');
      expect(orangeButton).toBeInTheDocument();
    });

    it("should highlight selected color with gold border", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawColor="#ff0000" />);

      const redButton = container.querySelector('button[title="#ff0000"]') as HTMLElement;
      expect(redButton.style.border).toBe("3px solid var(--jrpg-gold)");
    });

    it("should highlight selected color with gold box shadow", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawColor="#0000ff" />);

      const blueButton = container.querySelector('button[title="#0000ff"]') as HTMLElement;
      expect(blueButton.style.boxShadow).toBe("0 0 8px var(--jrpg-gold)");
    });

    it("should not highlight unselected colors", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawColor="#ff0000" />);

      const blueButton = container.querySelector('button[title="#0000ff"]') as HTMLElement;
      expect(blueButton.style.border).toBe("2px solid var(--jrpg-border-outer)");
    });

    it("should call onColorChange when preset color is clicked", () => {
      const onColorChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onColorChange={onColorChange} />,
      );

      const redButton = container.querySelector('button[title="#ff0000"]') as HTMLElement;
      fireEvent.click(redButton);

      expect(onColorChange).toHaveBeenCalledWith("#ff0000");
    });

    it("should call onColorChange for each preset color when clicked", () => {
      const onColorChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onColorChange={onColorChange} />,
      );

      const whiteButton = container.querySelector('button[title="#ffffff"]') as HTMLElement;
      const blackButton = container.querySelector('button[title="#000000"]') as HTMLElement;

      fireEvent.click(whiteButton);
      expect(onColorChange).toHaveBeenCalledWith("#ffffff");

      fireEvent.click(blackButton);
      expect(onColorChange).toHaveBeenCalledWith("#000000");
    });

    it("should render custom color picker", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const colorInput = container.querySelector('input[type="color"]');
      expect(colorInput).toBeInTheDocument();
    });

    it("should set custom color picker value to current color", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawColor="#abc123" />);

      const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
      expect(colorInput.value).toBe("#abc123");
    });

    it("should call onColorChange when custom color is selected", () => {
      const onColorChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onColorChange={onColorChange} />,
      );

      const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: "#123456" } });

      expect(onColorChange).toHaveBeenCalledWith("#123456");
    });
  });

  // =========================================================================
  // GROUP 4: Brush Size Control
  // =========================================================================

  describe("Brush Size Control", () => {
    it("should render brush size slider", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const brushSlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).min === "1",
      );

      expect(brushSlider).toBeInTheDocument();
    });

    it("should set brush size slider min to 1", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const brushSlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).min === "1",
      ) as HTMLInputElement;

      expect(brushSlider.min).toBe("1");
    });

    it("should set brush size slider max to 50", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const brushSlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).min === "1",
      ) as HTMLInputElement;

      expect(brushSlider.max).toBe("50");
    });

    it("should display current brush size value", () => {
      render(<DrawingToolbar {...defaultProps} drawWidth={25} />);

      expect(screen.getByText(/Brush Size: 25px/i)).toBeInTheDocument();
    });

    it("should set brush size slider value to drawWidth", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawWidth={15} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const brushSlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).min === "1",
      ) as HTMLInputElement;

      expect(brushSlider.value).toBe("15");
    });

    it("should call onWidthChange with number when slider changes", () => {
      const onWidthChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onWidthChange={onWidthChange} />,
      );

      const sliders = container.querySelectorAll('input[type="range"]');
      const brushSlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).min === "1",
      ) as HTMLInputElement;

      fireEvent.change(brushSlider, { target: { value: "30" } });

      expect(onWidthChange).toHaveBeenCalledWith(30);
    });

    it("should call onWidthChange with correct type (number not string)", () => {
      const onWidthChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onWidthChange={onWidthChange} />,
      );

      const sliders = container.querySelectorAll('input[type="range"]');
      const brushSlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).min === "1",
      ) as HTMLInputElement;

      fireEvent.change(brushSlider, { target: { value: "10" } });

      expect(onWidthChange).toHaveBeenCalledWith(10);
      expect(typeof onWidthChange.mock.calls[0][0]).toBe("number");
    });
  });

  // =========================================================================
  // GROUP 5: Opacity Control
  // =========================================================================

  describe("Opacity Control", () => {
    it("should render opacity slider when not using eraser", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const opacitySlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).max === "100" && (slider as HTMLInputElement).min === "0",
      );

      expect(opacitySlider).toBeInTheDocument();
    });

    it("should set opacity slider min to 0", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const opacitySlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).max === "100" && (slider as HTMLInputElement).min === "0",
      ) as HTMLInputElement;

      expect(opacitySlider.min).toBe("0");
    });

    it("should set opacity slider max to 100", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const opacitySlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).max === "100" && (slider as HTMLInputElement).min === "0",
      ) as HTMLInputElement;

      expect(opacitySlider.max).toBe("100");
    });

    it("should display opacity as percentage", () => {
      render(<DrawingToolbar {...defaultProps} drawOpacity={0.75} />);

      expect(screen.getByText(/Opacity: 75%/i)).toBeInTheDocument();
    });

    it("should display opacity rounded to nearest percent", () => {
      render(<DrawingToolbar {...defaultProps} drawOpacity={0.456} />);

      expect(screen.getByText(/Opacity: 46%/i)).toBeInTheDocument();
    });

    it("should display 100% opacity correctly", () => {
      render(<DrawingToolbar {...defaultProps} drawOpacity={1} />);

      expect(screen.getByText(/Opacity: 100%/i)).toBeInTheDocument();
    });

    it("should display 0% opacity correctly", () => {
      render(<DrawingToolbar {...defaultProps} drawOpacity={0} />);

      expect(screen.getByText(/Opacity: 0%/i)).toBeInTheDocument();
    });

    it("should set opacity slider value to percentage", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawOpacity={0.6} />);

      const sliders = container.querySelectorAll('input[type="range"]');
      const opacitySlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).max === "100" && (slider as HTMLInputElement).min === "0",
      ) as HTMLInputElement;

      expect(opacitySlider.value).toBe("60");
    });

    it("should call onOpacityChange with 0-1 value when slider changes", () => {
      const onOpacityChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onOpacityChange={onOpacityChange} />,
      );

      const sliders = container.querySelectorAll('input[type="range"]');
      const opacitySlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).max === "100" && (slider as HTMLInputElement).min === "0",
      ) as HTMLInputElement;

      fireEvent.change(opacitySlider, { target: { value: "50" } });

      expect(onOpacityChange).toHaveBeenCalledWith(0.5);
    });

    it("should convert percentage to decimal correctly", () => {
      const onOpacityChange = vi.fn();
      const { container } = render(
        <DrawingToolbar {...defaultProps} onOpacityChange={onOpacityChange} />,
      );

      const sliders = container.querySelectorAll('input[type="range"]');
      const opacitySlider = Array.from(sliders).find(
        (slider) => (slider as HTMLInputElement).max === "100" && (slider as HTMLInputElement).min === "0",
      ) as HTMLInputElement;

      fireEvent.change(opacitySlider, { target: { value: "75" } });

      expect(onOpacityChange).toHaveBeenCalledWith(0.75);
    });

    it("should not render opacity slider when using eraser", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      const opacityLabel = screen.queryByText(/Opacity:/i);
      expect(opacityLabel).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // GROUP 6: Fill Toggle
  // =========================================================================

  describe("Fill Toggle", () => {
    it("should render fill toggle when rect tool is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      expect(screen.getByText(/Filled/i)).toBeInTheDocument();
    });

    it("should render fill toggle when circle tool is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="circle" />);

      expect(screen.getByText(/Filled/i)).toBeInTheDocument();
    });

    it("should not render fill toggle when freehand tool is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      expect(screen.queryByText(/Filled/i)).not.toBeInTheDocument();
    });

    it("should not render fill toggle when line tool is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="line" />);

      expect(screen.queryByText(/Filled/i)).not.toBeInTheDocument();
    });

    it("should not render fill toggle when eraser tool is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      expect(screen.queryByText(/Filled/i)).not.toBeInTheDocument();
    });

    it("should render checkbox for fill toggle", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      const checkbox = container.querySelector('input[type="checkbox"]');
      expect(checkbox).toBeInTheDocument();
    });

    it("should set checkbox checked state to drawFilled", () => {
      const { container } = render(
        <DrawingToolbar {...defaultProps} drawTool="rect" drawFilled={true} />,
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("should set checkbox unchecked when drawFilled is false", () => {
      const { container } = render(
        <DrawingToolbar {...defaultProps} drawTool="rect" drawFilled={false} />,
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it("should call onFilledChange when checkbox is clicked", () => {
      const onFilledChange = vi.fn();
      const { container } = render(
        <DrawingToolbar
          {...defaultProps}
          drawTool="rect"
          drawFilled={false}
          onFilledChange={onFilledChange}
        />,
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(onFilledChange).toHaveBeenCalledWith(true);
    });

    it("should call onFilledChange with correct boolean value", () => {
      const onFilledChange = vi.fn();
      const { container } = render(
        <DrawingToolbar
          {...defaultProps}
          drawTool="circle"
          drawFilled={true}
          onFilledChange={onFilledChange}
        />,
      );

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(checkbox);

      expect(onFilledChange).toHaveBeenCalledWith(false);
    });
  });

  // =========================================================================
  // GROUP 7: Action Buttons - Undo/Redo
  // =========================================================================

  describe("Action Buttons - Undo/Redo", () => {
    it("should render undo button when onUndo is provided", () => {
      render(<DrawingToolbar {...defaultProps} onUndo={vi.fn()} />);

      expect(screen.getByText(/↶ Undo/i)).toBeInTheDocument();
    });

    it("should not render undo button when onUndo is not provided", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.queryByText(/↶ Undo/i)).not.toBeInTheDocument();
    });

    it("should render redo button when onRedo is provided", () => {
      render(<DrawingToolbar {...defaultProps} onRedo={vi.fn()} />);

      expect(screen.getByText(/↷ Redo/i)).toBeInTheDocument();
    });

    it("should not render redo button when onRedo is not provided", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.queryByText(/↷ Redo/i)).not.toBeInTheDocument();
    });

    it("should disable undo button when canUndo is false", () => {
      render(<DrawingToolbar {...defaultProps} onUndo={vi.fn()} canUndo={false} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));

      expect(undoButton).toBeDisabled();
    });

    it("should enable undo button when canUndo is true", () => {
      render(<DrawingToolbar {...defaultProps} onUndo={vi.fn()} canUndo={true} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));

      expect(undoButton).not.toBeDisabled();
    });

    it("should disable undo button by default when canUndo not specified", () => {
      render(<DrawingToolbar {...defaultProps} onUndo={vi.fn()} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));

      expect(undoButton).toBeDisabled();
    });

    it("should disable redo button when canRedo is false", () => {
      render(<DrawingToolbar {...defaultProps} onRedo={vi.fn()} canRedo={false} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      expect(redoButton).toBeDisabled();
    });

    it("should enable redo button when canRedo is true", () => {
      render(<DrawingToolbar {...defaultProps} onRedo={vi.fn()} canRedo={true} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      expect(redoButton).not.toBeDisabled();
    });

    it("should disable redo button by default when canRedo not specified", () => {
      render(<DrawingToolbar {...defaultProps} onRedo={vi.fn()} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      expect(redoButton).toBeDisabled();
    });

    it("should call onUndo when undo button is clicked", () => {
      const onUndo = vi.fn();
      render(<DrawingToolbar {...defaultProps} onUndo={onUndo} canUndo={true} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));

      fireEvent.click(undoButton!);

      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it("should call onRedo when redo button is clicked", () => {
      const onRedo = vi.fn();
      render(<DrawingToolbar {...defaultProps} onRedo={onRedo} canRedo={true} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      fireEvent.click(redoButton!);

      expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it("should render undo button with default variant", () => {
      render(<DrawingToolbar {...defaultProps} onUndo={vi.fn()} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));

      expect(undoButton).toHaveAttribute("data-variant", "default");
    });

    it("should render redo button with default variant", () => {
      render(<DrawingToolbar {...defaultProps} onRedo={vi.fn()} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      expect(redoButton).toHaveAttribute("data-variant", "default");
    });
  });

  // =========================================================================
  // GROUP 8: Action Buttons - Clear All
  // =========================================================================

  describe("Action Buttons - Clear All", () => {
    it("should always render clear all button", () => {
      render(<DrawingToolbar {...defaultProps} />);

      expect(screen.getByText(/🗑️ Clear All/i)).toBeInTheDocument();
    });

    it("should render clear all button with danger variant", () => {
      render(<DrawingToolbar {...defaultProps} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const clearButton = buttons.find((btn) => btn.textContent?.includes("🗑️ Clear All"));

      expect(clearButton).toHaveAttribute("data-variant", "danger");
    });

    it("should call onClearAll when clear all button is clicked", () => {
      const onClearAll = vi.fn();
      render(<DrawingToolbar {...defaultProps} onClearAll={onClearAll} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const clearButton = buttons.find((btn) => btn.textContent?.includes("🗑️ Clear All"));

      fireEvent.click(clearButton!);

      expect(onClearAll).toHaveBeenCalledTimes(1);
    });

    it("should not disable clear all button", () => {
      render(<DrawingToolbar {...defaultProps} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const clearButton = buttons.find((btn) => btn.textContent?.includes("🗑️ Clear All"));

      expect(clearButton).not.toBeDisabled();
    });
  });

  // =========================================================================
  // GROUP 9: Conditional Rendering - Color Palette
  // =========================================================================

  describe("Conditional Rendering - Color Palette", () => {
    it("should show color palette when freehand is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      expect(screen.getByText(/Color:/i)).toBeInTheDocument();
    });

    it("should show color palette when line is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="line" />);

      expect(screen.getByText(/Color:/i)).toBeInTheDocument();
    });

    it("should show color palette when rect is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      expect(screen.getByText(/Color:/i)).toBeInTheDocument();
    });

    it("should show color palette when circle is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="circle" />);

      expect(screen.getByText(/Color:/i)).toBeInTheDocument();
    });

    it("should hide color palette when eraser is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      expect(screen.queryByText(/Color:/i)).not.toBeInTheDocument();
    });

    it("should hide preset color buttons when eraser is selected", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      const colorButtons = container.querySelectorAll('button[title^="#"]');
      expect(colorButtons).toHaveLength(0);
    });

    it("should hide custom color picker when eraser is selected", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      const colorInput = container.querySelector('input[type="color"]');
      expect(colorInput).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // GROUP 10: Conditional Rendering - Opacity
  // =========================================================================

  describe("Conditional Rendering - Opacity", () => {
    it("should show opacity control when freehand is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      expect(screen.getByText(/Opacity:/i)).toBeInTheDocument();
    });

    it("should show opacity control when line is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="line" />);

      expect(screen.getByText(/Opacity:/i)).toBeInTheDocument();
    });

    it("should show opacity control when rect is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      expect(screen.getByText(/Opacity:/i)).toBeInTheDocument();
    });

    it("should show opacity control when circle is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="circle" />);

      expect(screen.getByText(/Opacity:/i)).toBeInTheDocument();
    });

    it("should hide opacity control when eraser is selected", () => {
      render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      expect(screen.queryByText(/Opacity:/i)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // GROUP 11: Close Handler
  // =========================================================================

  describe("Close Handler", () => {
    it("should call onClose when window close button is clicked", () => {
      const onClose = vi.fn();
      render(<DrawingToolbar {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByTestId("window-close");
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should not crash when onClose is undefined", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} />);

      expect(container).toBeTruthy();
    });
  });

  // =========================================================================
  // GROUP 12: Complete Interaction Flows
  // =========================================================================

  describe("Complete Interaction Flows", () => {
    it("should handle tool change and maintain other state", () => {
      const onToolChange = vi.fn();
      render(
        <DrawingToolbar
          {...defaultProps}
          drawTool="freehand"
          drawColor="#ff0000"
          drawWidth={10}
          onToolChange={onToolChange}
        />,
      );

      const buttons = screen.getAllByTestId("jrpg-button");
      const rectButton = buttons.find((btn) => btn.textContent?.includes("▭ Rect"));

      fireEvent.click(rectButton!);

      expect(onToolChange).toHaveBeenCalledWith("rect");
    });

    it("should handle color change and maintain other state", () => {
      const onColorChange = vi.fn();
      const { container } = render(
        <DrawingToolbar
          {...defaultProps}
          drawTool="freehand"
          drawColor="#ff0000"
          onColorChange={onColorChange}
        />,
      );

      const blueButton = container.querySelector('button[title="#0000ff"]') as HTMLElement;
      fireEvent.click(blueButton);

      expect(onColorChange).toHaveBeenCalledWith("#0000ff");
    });

    it("should handle switching from non-shape to shape tool", () => {
      const { rerender } = render(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      expect(screen.queryByText(/Filled/i)).not.toBeInTheDocument();

      rerender(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      expect(screen.getByText(/Filled/i)).toBeInTheDocument();
    });

    it("should handle switching from shape to eraser", () => {
      const { rerender } = render(<DrawingToolbar {...defaultProps} drawTool="rect" />);

      expect(screen.getByText(/Color:/i)).toBeInTheDocument();
      expect(screen.getByText(/Opacity:/i)).toBeInTheDocument();

      rerender(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      expect(screen.queryByText(/Color:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Opacity:/i)).not.toBeInTheDocument();
    });

    it("should handle switching from eraser to non-eraser", () => {
      const { rerender } = render(<DrawingToolbar {...defaultProps} drawTool="eraser" />);

      expect(screen.queryByText(/Color:/i)).not.toBeInTheDocument();

      rerender(<DrawingToolbar {...defaultProps} drawTool="freehand" />);

      expect(screen.getByText(/Color:/i)).toBeInTheDocument();
    });

    it("should handle multiple rapid tool changes", () => {
      const onToolChange = vi.fn();
      render(<DrawingToolbar {...defaultProps} onToolChange={onToolChange} />);

      const buttons = screen.getAllByTestId("jrpg-button");
      const freehandButton = buttons.find((btn) => btn.textContent?.includes("✏️ Draw"));
      const lineButton = buttons.find((btn) => btn.textContent?.includes("📏 Line"));
      const rectButton = buttons.find((btn) => btn.textContent?.includes("▭ Rect"));

      fireEvent.click(freehandButton!);
      fireEvent.click(lineButton!);
      fireEvent.click(rectButton!);

      expect(onToolChange).toHaveBeenCalledTimes(3);
      expect(onToolChange).toHaveBeenNthCalledWith(1, "freehand");
      expect(onToolChange).toHaveBeenNthCalledWith(2, "line");
      expect(onToolChange).toHaveBeenNthCalledWith(3, "rect");
    });
  });

  // =========================================================================
  // GROUP 13: Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle opacity of exactly 0.5", () => {
      render(<DrawingToolbar {...defaultProps} drawOpacity={0.5} />);

      expect(screen.getByText(/Opacity: 50%/i)).toBeInTheDocument();
    });

    it("should handle very small opacity values", () => {
      render(<DrawingToolbar {...defaultProps} drawOpacity={0.01} />);

      expect(screen.getByText(/Opacity: 1%/i)).toBeInTheDocument();
    });

    it("should handle brush size of 1", () => {
      render(<DrawingToolbar {...defaultProps} drawWidth={1} />);

      expect(screen.getByText(/Brush Size: 1px/i)).toBeInTheDocument();
    });

    it("should handle brush size of 50", () => {
      render(<DrawingToolbar {...defaultProps} drawWidth={50} />);

      expect(screen.getByText(/Brush Size: 50px/i)).toBeInTheDocument();
    });

    it("should handle custom color not in preset list", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} drawColor="#abc123" />);

      const colorInput = container.querySelector('input[type="color"]') as HTMLInputElement;
      expect(colorInput.value).toBe("#abc123");
    });

    it("should handle undo and redo both enabled", () => {
      render(
        <DrawingToolbar
          {...defaultProps}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={true}
          canRedo={true}
        />,
      );

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      expect(undoButton).not.toBeDisabled();
      expect(redoButton).not.toBeDisabled();
    });

    it("should handle undo and redo both disabled", () => {
      render(
        <DrawingToolbar
          {...defaultProps}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          canUndo={false}
          canRedo={false}
        />,
      );

      const buttons = screen.getAllByTestId("jrpg-button");
      const undoButton = buttons.find((btn) => btn.textContent?.includes("↶ Undo"));
      const redoButton = buttons.find((btn) => btn.textContent?.includes("↷ Redo"));

      expect(undoButton).toBeDisabled();
      expect(redoButton).toBeDisabled();
    });

    it("should handle all callbacks being undefined except required ones", () => {
      const { container } = render(<DrawingToolbar {...defaultProps} onClose={undefined} />);

      expect(container).toBeTruthy();
    });
  });
});
