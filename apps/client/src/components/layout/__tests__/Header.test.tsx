import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header, type ToolMode } from "../Header";
import type { JRPGButton, JRPGPanel } from "../../ui/JRPGPanel";

// Mock the JRPGPanel components
vi.mock("../../ui/JRPGPanel", () => ({
  JRPGPanel: ({ children, variant, style }: React.ComponentProps<typeof JRPGPanel>) => (
    <div data-testid={`jrpg-panel-${variant}`} style={style}>
      {children}
    </div>
  ),
  JRPGButton: ({
    children,
    onClick,
    variant,
    style,
    title,
  }: React.ComponentProps<typeof JRPGButton>) => (
    <button onClick={onClick} data-variant={variant} style={style} title={title}>
      {children}
    </button>
  ),
}));

/**
 * Test data factory for Header component props
 */
const createDefaultProps = () => ({
  uid: "12345678-1234-1234-1234-123456789012",
  snapToGrid: false,
  activeTool: null as ToolMode,
  crtFilter: false,
  diceRollerOpen: false,
  rollLogOpen: false,
  onSnapToGridChange: vi.fn(),
  onToolSelect: vi.fn(),
  onCrtFilterChange: vi.fn(),
  onDiceRollerToggle: vi.fn(),
  onRollLogToggle: vi.fn(),
  onResetCamera: vi.fn(),
});

/**
 * Comprehensive tests for Header component
 *
 * Tests all 188 LOC including:
 * - Component rendering
 * - Layout and styling
 * - Tool mode toggles
 * - Button interactions
 * - Derived boolean states
 * - Ref attachment
 */
describe("Header", () => {
  let props: ReturnType<typeof createDefaultProps>;

  beforeEach(() => {
    props = createDefaultProps();
  });

  describe("Rendering", () => {
    it("should render with all required props", () => {
      const { container } = render(<Header {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it("should render with fixed positioning", () => {
      const { container } = render(<Header {...props} />);
      const headerContainer = container.firstChild as HTMLElement;

      expect(headerContainer).toHaveStyle({
        position: "fixed",
        left: "0",
        right: "0",
      });
    });

    it("should have z-index 100", () => {
      const { container } = render(<Header {...props} />);
      const headerContainer = container.firstChild as HTMLElement;

      expect(headerContainer).toHaveStyle({
        zIndex: "100",
      });
    });

    it("should have top offset of 28px for status banner", () => {
      const { container } = render(<Header {...props} />);
      const headerContainer = container.firstChild as HTMLElement;

      expect(headerContainer).toHaveStyle({
        top: "28px",
      });
    });

    it("should have margin 0", () => {
      const { container } = render(<Header {...props} />);
      const headerContainer = container.firstChild as HTMLElement;

      expect(headerContainer).toHaveStyle({
        margin: "0",
      });
    });

    it("should render logo image with correct src", () => {
      render(<Header {...props} />);
      const logo = screen.getByAltText("HeroByte");

      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/logo.webp");
    });

    it("should render logo image with correct alt text", () => {
      render(<Header {...props} />);
      const logo = screen.getByAltText("HeroByte");

      expect(logo).toHaveAttribute("alt", "HeroByte");
    });

    it("should render logo with pixelated class", () => {
      render(<Header {...props} />);
      const logo = screen.getByAltText("HeroByte");

      expect(logo).toHaveClass("jrpg-pixelated");
    });

    it("should render logo with height 40px", () => {
      render(<Header {...props} />);
      const logo = screen.getByAltText("HeroByte");

      expect(logo).toHaveStyle({ height: "40px" });
    });

    it("should display UID label", () => {
      render(<Header {...props} />);
      expect(screen.getByText(/UID:/)).toBeInTheDocument();
    });

    it("should display truncated UID (first 8 chars + ...)", () => {
      render(<Header {...props} />);
      expect(screen.getByText("12345678...")).toBeInTheDocument();
    });

    it("should truncate UID correctly for different lengths", () => {
      const customProps = {
        ...props,
        uid: "abcdefghijklmnopqrstuvwxyz",
      };
      render(<Header {...customProps} />);
      expect(screen.getByText("abcdefgh...")).toBeInTheDocument();
    });

    it("should attach topPanelRef to container div when provided", () => {
      const topPanelRef = React.createRef<HTMLDivElement>();
      render(<Header {...props} topPanelRef={topPanelRef} />);

      expect(topPanelRef.current).toBeInTheDocument();
      expect(topPanelRef.current).toHaveStyle({
        position: "fixed",
        top: "28px",
      });
    });

    it("should render without topPanelRef when not provided", () => {
      const { container } = render(<Header {...props} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Layout and Styling", () => {
    it("should render bevel panel as main container", () => {
      render(<Header {...props} />);
      const bevelPanel = screen.getByTestId("jrpg-panel-bevel");

      expect(bevelPanel).toBeInTheDocument();
    });

    it("should have padding 8px and borderRadius 0 on bevel panel", () => {
      render(<Header {...props} />);
      const bevelPanel = screen.getByTestId("jrpg-panel-bevel");

      expect(bevelPanel).toHaveStyle({
        padding: "8px",
        borderRadius: "0",
      });
    });

    it("should have flexbox layout with gap 12px", () => {
      render(<Header {...props} />);
      const bevelPanel = screen.getByTestId("jrpg-panel-bevel");
      const flexContainer = bevelPanel.querySelector("div") as HTMLElement;

      expect(flexContainer).toHaveStyle({
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      });
    });

    it("should render left panel (logo + UID) with minWidth 200px", () => {
      render(<Header {...props} />);
      const simplePanels = screen.getAllByTestId("jrpg-panel-simple");
      const leftPanel = simplePanels[0];

      expect(leftPanel).toHaveStyle({
        padding: "8px",
        minWidth: "200px",
      });
    });

    it("should render right panel (controls) with flex: 1", () => {
      render(<Header {...props} />);
      const simplePanels = screen.getAllByTestId("jrpg-panel-simple");
      const rightPanel = simplePanels[1];

      expect(rightPanel).toHaveStyle({
        padding: "8px",
        flex: "1",
      });
    });

    it("should have flexWrap enabled for responsive layout", () => {
      render(<Header {...props} />);
      const simplePanels = screen.getAllByTestId("jrpg-panel-simple");
      const rightPanel = simplePanels[1];
      const controlsContainer = rightPanel.querySelector("div") as HTMLElement;

      expect(controlsContainer).toHaveStyle({
        display: "flex",
        gap: "12px",
        alignItems: "center",
        flexWrap: "wrap",
      });
    });

    it("should render all buttons with fontSize 8px", () => {
      render(<Header {...props} />);
      const buttons = screen.getAllByRole("button");

      buttons.forEach((button) => {
        expect(button).toHaveStyle({ fontSize: "8px" });
      });
    });

    it("should render all buttons with padding 6px 12px", () => {
      render(<Header {...props} />);
      const buttons = screen.getAllByRole("button");

      buttons.forEach((button) => {
        expect(button).toHaveStyle({ padding: "6px 12px" });
      });
    });
  });

  describe("Snap to Grid Button", () => {
    it("should render with 'Snap' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "Snap" })).toBeInTheDocument();
    });

    it("should have primary variant when snapToGrid is true", () => {
      const customProps = { ...props, snapToGrid: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "Snap" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when snapToGrid is false", () => {
      const customProps = { ...props, snapToGrid: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "Snap" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should toggle snapToGrid from false to true on click", () => {
      const customProps = { ...props, snapToGrid: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "Snap" });

      fireEvent.click(button);

      expect(props.onSnapToGridChange).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).toHaveBeenCalledWith(true);
    });

    it("should toggle snapToGrid from true to false on click", () => {
      const customProps = { ...props, snapToGrid: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "Snap" });

      fireEvent.click(button);

      expect(props.onSnapToGridChange).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).toHaveBeenCalledWith(false);
    });

    it("should call onSnapToGridChange with correct value", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "Snap" });

      fireEvent.click(button);

      expect(props.onSnapToGridChange).toHaveBeenCalledWith(true);
    });
  });

  describe("Reset Camera Button", () => {
    it("should render with '🧭 Recenter' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "🧭 Recenter" })).toBeInTheDocument();
    });

    it("should always have default variant", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "🧭 Recenter" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should call onResetCamera on click", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "🧭 Recenter" });

      fireEvent.click(button);

      expect(props.onResetCamera).toHaveBeenCalledTimes(1);
    });

    it("should not call other handlers when clicked", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "🧭 Recenter" });

      fireEvent.click(button);

      expect(props.onSnapToGridChange).not.toHaveBeenCalled();
      expect(props.onToolSelect).not.toHaveBeenCalled();
    });
  });

  describe("Tool Mode Buttons - Pointer", () => {
    it("should render with '👆 Pointer' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "👆 Pointer" })).toBeInTheDocument();
    });

    it("should have primary variant when activeTool is 'pointer'", () => {
      const customProps = { ...props, activeTool: "pointer" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when activeTool is not 'pointer'", () => {
      const customProps = { ...props, activeTool: "measure" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should have default variant when activeTool is null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should activate pointer mode when clicked from null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith("pointer");
    });

    it("should deactivate pointer mode when clicked while active", () => {
      const customProps = { ...props, activeTool: "pointer" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Tool Mode Buttons - Measure", () => {
    it("should render with '📏 Measure' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "📏 Measure" })).toBeInTheDocument();
    });

    it("should have primary variant when activeTool is 'measure'", () => {
      const customProps = { ...props, activeTool: "measure" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📏 Measure" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when activeTool is not 'measure'", () => {
      const customProps = { ...props, activeTool: "pointer" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📏 Measure" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should activate measure mode when clicked from null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📏 Measure" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith("measure");
    });

    it("should deactivate measure mode when clicked while active", () => {
      const customProps = { ...props, activeTool: "measure" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📏 Measure" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Tool Mode Buttons - Draw", () => {
    it("should render with '✏️ Draw Tools' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "✏️ Draw Tools" })).toBeInTheDocument();
    });

    it("should have primary variant when activeTool is 'draw'", () => {
      const customProps = { ...props, activeTool: "draw" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "✏️ Draw Tools" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when activeTool is not 'draw'", () => {
      const customProps = { ...props, activeTool: "select" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "✏️ Draw Tools" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should activate draw mode when clicked from null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "✏️ Draw Tools" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith("draw");
    });

    it("should deactivate draw mode when clicked while active", () => {
      const customProps = { ...props, activeTool: "draw" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "✏️ Draw Tools" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Tool Mode Buttons - Transform", () => {
    it("should render with '🔄 Transform' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "🔄 Transform" })).toBeInTheDocument();
    });

    it("should have title attribute 'Scale and rotate objects'", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "🔄 Transform" });

      expect(button).toHaveAttribute("title", "Scale and rotate objects");
    });

    it("should have primary variant when activeTool is 'transform'", () => {
      const customProps = { ...props, activeTool: "transform" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🔄 Transform" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when activeTool is not 'transform'", () => {
      const customProps = { ...props, activeTool: "draw" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🔄 Transform" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should activate transform mode when clicked from null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🔄 Transform" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith("transform");
    });

    it("should deactivate transform mode when clicked while active", () => {
      const customProps = { ...props, activeTool: "transform" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🔄 Transform" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Tool Mode Buttons - Select", () => {
    it("should render with '🖱️ Select' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "🖱️ Select" })).toBeInTheDocument();
    });

    it("should have primary variant when activeTool is 'select'", () => {
      const customProps = { ...props, activeTool: "select" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🖱️ Select" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when activeTool is not 'select'", () => {
      const customProps = { ...props, activeTool: "transform" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🖱️ Select" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should activate select mode when clicked from null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🖱️ Select" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith("select");
    });

    it("should deactivate select mode when clicked while active", () => {
      const customProps = { ...props, activeTool: "select" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🖱️ Select" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Derived Boolean States", () => {
    it("should derive pointerMode from activeTool === 'pointer'", () => {
      const customProps = { ...props, activeTool: "pointer" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should derive measureMode from activeTool === 'measure'", () => {
      const customProps = { ...props, activeTool: "measure" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📏 Measure" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should derive drawMode from activeTool === 'draw'", () => {
      const customProps = { ...props, activeTool: "draw" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "✏️ Draw Tools" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should derive transformMode from activeTool === 'transform'", () => {
      const customProps = { ...props, activeTool: "transform" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🔄 Transform" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should derive selectMode from activeTool === 'select'", () => {
      const customProps = { ...props, activeTool: "select" as ToolMode };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "🖱️ Select" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should handle activeTool being null", () => {
      const customProps = { ...props, activeTool: null };
      render(<Header {...customProps} />);

      const pointerButton = screen.getByRole("button", { name: "👆 Pointer" });
      const measureButton = screen.getByRole("button", { name: "📏 Measure" });
      const drawButton = screen.getByRole("button", { name: "✏️ Draw Tools" });
      const transformButton = screen.getByRole("button", { name: "🔄 Transform" });
      const selectButton = screen.getByRole("button", { name: "🖱️ Select" });

      expect(pointerButton).toHaveAttribute("data-variant", "default");
      expect(measureButton).toHaveAttribute("data-variant", "default");
      expect(drawButton).toHaveAttribute("data-variant", "default");
      expect(transformButton).toHaveAttribute("data-variant", "default");
      expect(selectButton).toHaveAttribute("data-variant", "default");
    });

    it("should only activate one tool mode at a time", () => {
      const customProps = { ...props, activeTool: "pointer" as ToolMode };
      render(<Header {...customProps} />);

      const pointerButton = screen.getByRole("button", { name: "👆 Pointer" });
      const measureButton = screen.getByRole("button", { name: "📏 Measure" });
      const drawButton = screen.getByRole("button", { name: "✏️ Draw Tools" });
      const transformButton = screen.getByRole("button", { name: "🔄 Transform" });
      const selectButton = screen.getByRole("button", { name: "🖱️ Select" });

      expect(pointerButton).toHaveAttribute("data-variant", "primary");
      expect(measureButton).toHaveAttribute("data-variant", "default");
      expect(drawButton).toHaveAttribute("data-variant", "default");
      expect(transformButton).toHaveAttribute("data-variant", "default");
      expect(selectButton).toHaveAttribute("data-variant", "default");
    });
  });

  describe("CRT Filter Button", () => {
    it("should render with '📺 CRT' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "📺 CRT" })).toBeInTheDocument();
    });

    it("should have primary variant when crtFilter is true", () => {
      const customProps = { ...props, crtFilter: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📺 CRT" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when crtFilter is false", () => {
      const customProps = { ...props, crtFilter: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📺 CRT" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should toggle crtFilter from false to true on click", () => {
      const customProps = { ...props, crtFilter: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📺 CRT" });

      fireEvent.click(button);

      expect(props.onCrtFilterChange).toHaveBeenCalledTimes(1);
      expect(props.onCrtFilterChange).toHaveBeenCalledWith(true);
    });

    it("should toggle crtFilter from true to false on click", () => {
      const customProps = { ...props, crtFilter: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📺 CRT" });

      fireEvent.click(button);

      expect(props.onCrtFilterChange).toHaveBeenCalledTimes(1);
      expect(props.onCrtFilterChange).toHaveBeenCalledWith(false);
    });

    it("should call onCrtFilterChange with correct value", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "📺 CRT" });

      fireEvent.click(button);

      expect(props.onCrtFilterChange).toHaveBeenCalledWith(true);
    });
  });

  describe("Dice Roller Button", () => {
    it("should render with '⚂ Dice' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "⚂ Dice" })).toBeInTheDocument();
    });

    it("should have primary variant when diceRollerOpen is true", () => {
      const customProps = { ...props, diceRollerOpen: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "⚂ Dice" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when diceRollerOpen is false", () => {
      const customProps = { ...props, diceRollerOpen: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "⚂ Dice" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should toggle diceRollerOpen from false to true on click", () => {
      const customProps = { ...props, diceRollerOpen: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "⚂ Dice" });

      fireEvent.click(button);

      expect(props.onDiceRollerToggle).toHaveBeenCalledTimes(1);
      expect(props.onDiceRollerToggle).toHaveBeenCalledWith(true);
    });

    it("should toggle diceRollerOpen from true to false on click", () => {
      const customProps = { ...props, diceRollerOpen: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "⚂ Dice" });

      fireEvent.click(button);

      expect(props.onDiceRollerToggle).toHaveBeenCalledTimes(1);
      expect(props.onDiceRollerToggle).toHaveBeenCalledWith(false);
    });

    it("should call onDiceRollerToggle with correct value", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "⚂ Dice" });

      fireEvent.click(button);

      expect(props.onDiceRollerToggle).toHaveBeenCalledWith(true);
    });
  });

  describe("Roll Log Button", () => {
    it("should render with '📜 Log' text", () => {
      render(<Header {...props} />);
      expect(screen.getByRole("button", { name: "📜 Log" })).toBeInTheDocument();
    });

    it("should have primary variant when rollLogOpen is true", () => {
      const customProps = { ...props, rollLogOpen: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📜 Log" });

      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should have default variant when rollLogOpen is false", () => {
      const customProps = { ...props, rollLogOpen: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📜 Log" });

      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should toggle rollLogOpen from false to true on click", () => {
      const customProps = { ...props, rollLogOpen: false };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📜 Log" });

      fireEvent.click(button);

      expect(props.onRollLogToggle).toHaveBeenCalledTimes(1);
      expect(props.onRollLogToggle).toHaveBeenCalledWith(true);
    });

    it("should toggle rollLogOpen from true to false on click", () => {
      const customProps = { ...props, rollLogOpen: true };
      render(<Header {...customProps} />);
      const button = screen.getByRole("button", { name: "📜 Log" });

      fireEvent.click(button);

      expect(props.onRollLogToggle).toHaveBeenCalledTimes(1);
      expect(props.onRollLogToggle).toHaveBeenCalledWith(false);
    });

    it("should call onRollLogToggle with correct value", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "📜 Log" });

      fireEvent.click(button);

      expect(props.onRollLogToggle).toHaveBeenCalledWith(true);
    });
  });

  describe("Button Interaction Isolation", () => {
    it("should only call corresponding handler when snap button is clicked", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "Snap" });

      fireEvent.click(button);

      expect(props.onSnapToGridChange).toHaveBeenCalledTimes(1);
      expect(props.onToolSelect).not.toHaveBeenCalled();
      expect(props.onCrtFilterChange).not.toHaveBeenCalled();
      expect(props.onDiceRollerToggle).not.toHaveBeenCalled();
      expect(props.onRollLogToggle).not.toHaveBeenCalled();
      expect(props.onResetCamera).not.toHaveBeenCalled();
    });

    it("should only call corresponding handler when tool button is clicked", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "👆 Pointer" });

      fireEvent.click(button);

      expect(props.onToolSelect).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).not.toHaveBeenCalled();
      expect(props.onCrtFilterChange).not.toHaveBeenCalled();
      expect(props.onDiceRollerToggle).not.toHaveBeenCalled();
      expect(props.onRollLogToggle).not.toHaveBeenCalled();
      expect(props.onResetCamera).not.toHaveBeenCalled();
    });

    it("should only call corresponding handler when CRT button is clicked", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "📺 CRT" });

      fireEvent.click(button);

      expect(props.onCrtFilterChange).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).not.toHaveBeenCalled();
      expect(props.onToolSelect).not.toHaveBeenCalled();
      expect(props.onDiceRollerToggle).not.toHaveBeenCalled();
      expect(props.onRollLogToggle).not.toHaveBeenCalled();
      expect(props.onResetCamera).not.toHaveBeenCalled();
    });

    it("should only call corresponding handler when dice button is clicked", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "⚂ Dice" });

      fireEvent.click(button);

      expect(props.onDiceRollerToggle).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).not.toHaveBeenCalled();
      expect(props.onToolSelect).not.toHaveBeenCalled();
      expect(props.onCrtFilterChange).not.toHaveBeenCalled();
      expect(props.onRollLogToggle).not.toHaveBeenCalled();
      expect(props.onResetCamera).not.toHaveBeenCalled();
    });

    it("should only call corresponding handler when log button is clicked", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "📜 Log" });

      fireEvent.click(button);

      expect(props.onRollLogToggle).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).not.toHaveBeenCalled();
      expect(props.onToolSelect).not.toHaveBeenCalled();
      expect(props.onCrtFilterChange).not.toHaveBeenCalled();
      expect(props.onDiceRollerToggle).not.toHaveBeenCalled();
      expect(props.onResetCamera).not.toHaveBeenCalled();
    });
  });

  describe("All Tool Modes Coverage", () => {
    it("should handle activeTool 'align' mode", () => {
      const customProps = { ...props, activeTool: "align" as ToolMode };
      render(<Header {...customProps} />);

      // Verify all tool buttons show default variant when activeTool is 'align'
      const pointerButton = screen.getByRole("button", { name: "👆 Pointer" });
      const measureButton = screen.getByRole("button", { name: "📏 Measure" });
      const drawButton = screen.getByRole("button", { name: "✏️ Draw Tools" });
      const transformButton = screen.getByRole("button", { name: "🔄 Transform" });
      const selectButton = screen.getByRole("button", { name: "🖱️ Select" });

      expect(pointerButton).toHaveAttribute("data-variant", "default");
      expect(measureButton).toHaveAttribute("data-variant", "default");
      expect(drawButton).toHaveAttribute("data-variant", "default");
      expect(transformButton).toHaveAttribute("data-variant", "default");
      expect(selectButton).toHaveAttribute("data-variant", "default");
    });

    it("should switch between different tool modes correctly", () => {
      const { rerender } = render(<Header {...props} activeTool="pointer" />);
      let button = screen.getByRole("button", { name: "👆 Pointer" });
      expect(button).toHaveAttribute("data-variant", "primary");

      rerender(<Header {...props} activeTool="measure" />);
      button = screen.getByRole("button", { name: "📏 Measure" });
      expect(button).toHaveAttribute("data-variant", "primary");

      rerender(<Header {...props} activeTool="draw" />);
      button = screen.getByRole("button", { name: "✏️ Draw Tools" });
      expect(button).toHaveAttribute("data-variant", "primary");

      rerender(<Header {...props} activeTool="transform" />);
      button = screen.getByRole("button", { name: "🔄 Transform" });
      expect(button).toHaveAttribute("data-variant", "primary");

      rerender(<Header {...props} activeTool="select" />);
      button = screen.getByRole("button", { name: "🖱️ Select" });
      expect(button).toHaveAttribute("data-variant", "primary");
    });
  });

  describe("Component Re-rendering", () => {
    it("should update UID display when prop changes", () => {
      const { rerender } = render(<Header {...props} uid="11111111-aaaa-bbbb-cccc-dddddddddddd" />);
      expect(screen.getByText("11111111...")).toBeInTheDocument();

      rerender(<Header {...props} uid="99999999-zzzz-yyyy-xxxx-wwwwwwwwwwww" />);
      expect(screen.getByText("99999999...")).toBeInTheDocument();
    });

    it("should update button variants when snapToGrid changes", () => {
      const { rerender } = render(<Header {...props} snapToGrid={false} />);
      let button = screen.getByRole("button", { name: "Snap" });
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} snapToGrid={true} />);
      button = screen.getByRole("button", { name: "Snap" });
      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should update button variants when crtFilter changes", () => {
      const { rerender } = render(<Header {...props} crtFilter={false} />);
      let button = screen.getByRole("button", { name: "📺 CRT" });
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} crtFilter={true} />);
      button = screen.getByRole("button", { name: "📺 CRT" });
      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should update button variants when diceRollerOpen changes", () => {
      const { rerender } = render(<Header {...props} diceRollerOpen={false} />);
      let button = screen.getByRole("button", { name: "⚂ Dice" });
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} diceRollerOpen={true} />);
      button = screen.getByRole("button", { name: "⚂ Dice" });
      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should update button variants when rollLogOpen changes", () => {
      const { rerender } = render(<Header {...props} rollLogOpen={false} />);
      let button = screen.getByRole("button", { name: "📜 Log" });
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} rollLogOpen={true} />);
      button = screen.getByRole("button", { name: "📜 Log" });
      expect(button).toHaveAttribute("data-variant", "primary");
    });
  });
});
