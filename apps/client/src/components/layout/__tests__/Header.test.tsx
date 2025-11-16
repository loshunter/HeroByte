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
 * Optimized tests for Header component
 *
 * Tests all 188 LOC including:
 * - Component rendering and structure
 * - Layout and styling
 * - Tool mode toggles
 * - Button interactions
 * - Derived boolean states
 * - Ref attachment
 *
 * Optimization: Consolidated repetitive tests to reduce render count from 96 to ~30
 * while maintaining 100% coverage. Multiple related assertions now share single renders.
 */
describe("Header", () => {
  let props: ReturnType<typeof createDefaultProps>;

  beforeEach(() => {
    props = createDefaultProps();
  });

  describe("Container Structure and Styling", () => {
    it("should render with correct container positioning and layout", () => {
      const { container } = render(<Header {...props} />);
      const headerContainer = container.firstChild as HTMLElement;

      expect(headerContainer).toBeInTheDocument();
      expect(headerContainer).toHaveStyle({
        position: "fixed",
        top: "28px",
        left: "0",
        right: "0",
        zIndex: "100",
        margin: "0",
      });
    });

    it("should render with bevel panel and flexbox layout", () => {
      render(<Header {...props} />);
      const bevelPanel = screen.getByTestId("jrpg-panel-bevel");
      const flexContainer = bevelPanel.querySelector("div") as HTMLElement;

      expect(bevelPanel).toBeInTheDocument();
      expect(bevelPanel).toHaveStyle({
        padding: "8px",
        borderRadius: "0",
      });
      expect(flexContainer).toHaveStyle({
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      });
    });

    it("should render left and right panels with correct styling", () => {
      render(<Header {...props} />);
      const simplePanels = screen.getAllByTestId("jrpg-panel-simple");
      const leftPanel = simplePanels[0];
      const rightPanel = simplePanels[1];
      const controlsContainer = rightPanel.querySelector("div") as HTMLElement;

      expect(leftPanel).toHaveStyle({
        padding: "8px",
        minWidth: "200px",
      });
      expect(rightPanel).toHaveStyle({
        padding: "8px",
        flex: "1",
      });
      expect(controlsContainer).toHaveStyle({
        display: "flex",
        gap: "12px",
        alignItems: "center",
        flexWrap: "wrap",
      });
    });

    it("should render all buttons with consistent styling", () => {
      render(<Header {...props} />);
      const buttons = screen.getAllByRole("button");

      buttons.forEach((button) => {
        expect(button).toHaveStyle({
          fontSize: "8px",
          padding: "6px 12px",
        });
      });
    });
  });

  describe("Logo and UID Display", () => {
    it("should render logo with correct attributes and styling", () => {
      render(<Header {...props} />);
      const logo = screen.getByAltText("HeroByte");

      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute("src", "/logo.webp");
      expect(logo).toHaveAttribute("alt", "HeroByte");
      expect(logo).toHaveClass("jrpg-pixelated");
      expect(logo).toHaveStyle({ height: "40px" });
    });

    it("should display UID label and truncated UID", () => {
      render(<Header {...props} />);

      expect(screen.getByText(/UID:/)).toBeInTheDocument();
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
  });

  describe("Ref Attachment", () => {
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

  describe("Snap to Grid Button", () => {
    it("should render and respond to snapToGrid state", () => {
      const { rerender } = render(<Header {...props} snapToGrid={false} />);
      let button = screen.getByRole("button", { name: "Snap" });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} snapToGrid={true} />);
      button = screen.getByRole("button", { name: "Snap" });
      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should toggle snapToGrid state on click", () => {
      const { rerender } = render(<Header {...props} snapToGrid={false} />);
      let button = screen.getByRole("button", { name: "Snap" });

      fireEvent.click(button);
      expect(props.onSnapToGridChange).toHaveBeenCalledWith(true);

      rerender(<Header {...props} snapToGrid={true} />);
      button = screen.getByRole("button", { name: "Snap" });

      fireEvent.click(button);
      expect(props.onSnapToGridChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Reset Camera Button", () => {
    it("should render with correct text and variant", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "🧭 Recenter" });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should call onResetCamera on click without affecting other handlers", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: "🧭 Recenter" });

      fireEvent.click(button);

      expect(props.onResetCamera).toHaveBeenCalledTimes(1);
      expect(props.onSnapToGridChange).not.toHaveBeenCalled();
      expect(props.onToolSelect).not.toHaveBeenCalled();
    });
  });

  describe.each<{ tool: ToolMode; label: string; title?: string }>([
    { tool: "pointer", label: "👆 Pointer" },
    { tool: "measure", label: "📏 Measure" },
    { tool: "draw", label: "✏️ Draw Tools" },
    { tool: "transform", label: "🔄 Transform", title: "Scale and rotate objects" },
    { tool: "select", label: "🖱️ Select" },
  ])("Tool Mode Button - $tool", ({ tool, label, title }) => {
    it("should render with correct text and optional title", () => {
      render(<Header {...props} />);
      const button = screen.getByRole("button", { name: label });

      expect(button).toBeInTheDocument();
      if (title) {
        expect(button).toHaveAttribute("title", title);
      }
    });

    it("should have primary variant when active, default when inactive", () => {
      const { rerender } = render(<Header {...props} activeTool={tool} />);
      let button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("data-variant", "primary");

      rerender(<Header {...props} activeTool={null} />);
      button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} activeTool={tool === "pointer" ? "measure" : "pointer"} />);
      button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("data-variant", "default");
    });

    it("should toggle tool mode on click", () => {
      const { rerender } = render(<Header {...props} activeTool={null} />);
      let button = screen.getByRole("button", { name: label });

      fireEvent.click(button);
      expect(props.onToolSelect).toHaveBeenCalledWith(tool);

      rerender(<Header {...props} activeTool={tool} />);
      button = screen.getByRole("button", { name: label });

      fireEvent.click(button);
      expect(props.onToolSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Derived Boolean States", () => {
    it("should only activate one tool mode at a time", () => {
      const { rerender } = render(<Header {...props} activeTool={null} />);
      const allButtons = [
        screen.getByRole("button", { name: "👆 Pointer" }),
        screen.getByRole("button", { name: "📏 Measure" }),
        screen.getByRole("button", { name: "✏️ Draw Tools" }),
        screen.getByRole("button", { name: "🔄 Transform" }),
        screen.getByRole("button", { name: "🖱️ Select" }),
      ];

      allButtons.forEach((btn) => expect(btn).toHaveAttribute("data-variant", "default"));

      rerender(<Header {...props} activeTool="pointer" />);
      expect(screen.getByRole("button", { name: "👆 Pointer" })).toHaveAttribute(
        "data-variant",
        "primary",
      );
      allButtons.slice(1).forEach((btn) => expect(btn).toHaveAttribute("data-variant", "default"));
    });

    it("should handle non-displayed tool modes (align)", () => {
      render(<Header {...props} activeTool={"align" as ToolMode} />);
      const allButtons = [
        screen.getByRole("button", { name: "👆 Pointer" }),
        screen.getByRole("button", { name: "📏 Measure" }),
        screen.getByRole("button", { name: "✏️ Draw Tools" }),
        screen.getByRole("button", { name: "🔄 Transform" }),
        screen.getByRole("button", { name: "🖱️ Select" }),
      ];

      allButtons.forEach((btn) => expect(btn).toHaveAttribute("data-variant", "default"));
    });

    it("should switch between different tool modes correctly", () => {
      const { rerender } = render(<Header {...props} activeTool="pointer" />);
      expect(screen.getByRole("button", { name: "👆 Pointer" })).toHaveAttribute(
        "data-variant",
        "primary",
      );

      rerender(<Header {...props} activeTool="measure" />);
      expect(screen.getByRole("button", { name: "📏 Measure" })).toHaveAttribute(
        "data-variant",
        "primary",
      );

      rerender(<Header {...props} activeTool="draw" />);
      expect(screen.getByRole("button", { name: "✏️ Draw Tools" })).toHaveAttribute(
        "data-variant",
        "primary",
      );

      rerender(<Header {...props} activeTool="transform" />);
      expect(screen.getByRole("button", { name: "🔄 Transform" })).toHaveAttribute(
        "data-variant",
        "primary",
      );

      rerender(<Header {...props} activeTool="select" />);
      expect(screen.getByRole("button", { name: "🖱️ Select" })).toHaveAttribute(
        "data-variant",
        "primary",
      );
    });
  });

  describe.each<{
    prop: "crtFilter" | "diceRollerOpen" | "rollLogOpen";
    label: string;
    handler: string;
  }>([
    { prop: "crtFilter", label: "📺 CRT", handler: "onCrtFilterChange" },
    { prop: "diceRollerOpen", label: "⚂ Dice", handler: "onDiceRollerToggle" },
    { prop: "rollLogOpen", label: "📜 Log", handler: "onRollLogToggle" },
  ])("Toggle Button - $label", ({ prop, label, handler }) => {
    it("should render with correct variant based on state", () => {
      const { rerender } = render(<Header {...props} {...{ [prop]: false }} />);
      let button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("data-variant", "default");

      rerender(<Header {...props} {...{ [prop]: true }} />);
      button = screen.getByRole("button", { name: label });
      expect(button).toHaveAttribute("data-variant", "primary");
    });

    it("should toggle state on click", () => {
      const { rerender } = render(<Header {...props} {...{ [prop]: false }} />);
      let button = screen.getByRole("button", { name: label });

      fireEvent.click(button);
      expect(props[handler as keyof typeof props]).toHaveBeenCalledWith(true);

      rerender(<Header {...props} {...{ [prop]: true }} />);
      button = screen.getByRole("button", { name: label });

      fireEvent.click(button);
      expect(props[handler as keyof typeof props]).toHaveBeenCalledWith(false);
    });
  });

  describe("Button Interaction Isolation", () => {
    it("should only call corresponding handler for each button type", () => {
      render(<Header {...props} />);

      const testCases = [
        {
          name: "Snap",
          handler: "onSnapToGridChange",
          excluded: [
            "onToolSelect",
            "onCrtFilterChange",
            "onDiceRollerToggle",
            "onRollLogToggle",
            "onResetCamera",
          ],
        },
        {
          name: "👆 Pointer",
          handler: "onToolSelect",
          excluded: [
            "onSnapToGridChange",
            "onCrtFilterChange",
            "onDiceRollerToggle",
            "onRollLogToggle",
            "onResetCamera",
          ],
        },
        {
          name: "📺 CRT",
          handler: "onCrtFilterChange",
          excluded: [
            "onSnapToGridChange",
            "onToolSelect",
            "onDiceRollerToggle",
            "onRollLogToggle",
            "onResetCamera",
          ],
        },
        {
          name: "⚂ Dice",
          handler: "onDiceRollerToggle",
          excluded: [
            "onSnapToGridChange",
            "onToolSelect",
            "onCrtFilterChange",
            "onRollLogToggle",
            "onResetCamera",
          ],
        },
        {
          name: "📜 Log",
          handler: "onRollLogToggle",
          excluded: [
            "onSnapToGridChange",
            "onToolSelect",
            "onCrtFilterChange",
            "onDiceRollerToggle",
            "onResetCamera",
          ],
        },
      ];

      testCases.forEach(({ name, handler, excluded }) => {
        const button = screen.getByRole("button", { name });
        fireEvent.click(button);

        expect(props[handler as keyof typeof props]).toHaveBeenCalled();
        excluded.forEach((excludedHandler) => {
          expect(props[excludedHandler as keyof typeof props]).not.toHaveBeenCalled();
        });

        // Reset mocks for next iteration
        Object.values(props).forEach((val) => {
          if (typeof val === "function" && "mockClear" in val) {
            (val as any).mockClear();
          }
        });
      });
    });
  });

  describe("Component Re-rendering", () => {
    it("should update UID display when prop changes", () => {
      const { rerender } = render(<Header {...props} uid="11111111-aaaa-bbbb-cccc-dddddddddddd" />);
      expect(screen.getByText("11111111...")).toBeInTheDocument();

      rerender(<Header {...props} uid="99999999-zzzz-yyyy-xxxx-wwwwwwwwwwww" />);
      expect(screen.getByText("99999999...")).toBeInTheDocument();
    });
  });
});
