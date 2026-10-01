import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header, type ToolMode } from "../Header";
import type { JRPGButton, JRPGPanel } from "../../ui/JRPGPanel";
import type { TableMenuProps } from "../../../features/table/tableMenuProps";
import { ReconnectPhaseContext } from "../../../features/table/reconnectPhase";

// The Table button is its own component with its own suite (features/table). Here
// it is a stub that shows what the header HANDED it: the header's job is to give it
// the table's object and its place, not to re-test it.
vi.mock("../../../features/table/TableMenu", () => ({
  TableMenu: ({ menu }: { menu: TableMenuProps }) => (
    <div
      data-testid="table-menu"
      data-dm={String(menu.isDM)}
      data-connected={String(menu.isConnected)}
    >
      {menu.tableName}
    </div>
  ),
}));

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
const tableMenu = (overrides: Partial<TableMenuProps> = {}): TableMenuProps => ({
  uid: "12345678-1234-1234-1234-123456789012",
  tableName: "Sunday Game",
  isPublicTable: false,
  isConnected: true,
  isDM: false,
  roleKnown: true,
  onToggleDM: vi.fn(),
  crtFilter: false,
  onCrtFilterChange: vi.fn(),
  ...overrides,
});

const createDefaultProps = () => ({
  table: tableMenu(),
  snapToGrid: false,
  activeTool: null as ToolMode,
  diceRollerOpen: false,
  rollLogOpen: false,
  onSnapToGridChange: vi.fn(),
  onToolSelect: vi.fn(),
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

  describe("Player lens toggle (P4)", () => {
    it("shows the toggle only for a DM with a handler wired", () => {
      const onPlayerLensChange = vi.fn();
      const dm = tableMenu({ isDM: true });
      const { rerender } = render(
        <Header {...props} table={dm} onPlayerLensChange={onPlayerLensChange} />,
      );
      expect(screen.getByText(/Player View/)).toBeTruthy();
      rerender(<Header {...props} table={tableMenu()} onPlayerLensChange={onPlayerLensChange} />);
      expect(screen.queryByText(/Player View/)).toBeNull();
      rerender(<Header {...props} table={dm} />);
      expect(screen.queryByText(/Player View/)).toBeNull();
    });

    it("toggles the lens and reflects its active state", () => {
      const onPlayerLensChange = vi.fn();
      const dm = tableMenu({ isDM: true });
      const { rerender } = render(
        <Header {...props} table={dm} playerLens={false} onPlayerLensChange={onPlayerLensChange} />,
      );
      const button = screen.getByText(/Player View/);
      expect(button.getAttribute("data-variant")).toBe("default");
      fireEvent.click(button);
      expect(onPlayerLensChange).toHaveBeenCalledWith(true);
      rerender(
        <Header {...props} table={dm} playerLens={true} onPlayerLensChange={onPlayerLensChange} />,
      );
      expect(screen.getByText(/Player View/).getAttribute("data-variant")).toBe("primary");
    });
  });

  describe("Container Structure and Styling", () => {
    it("should render with correct container positioning and layout", () => {
      const { container } = render(<Header {...props} />);
      const headerContainer = container.firstChild as HTMLElement;

      expect(headerContainer).toBeInTheDocument();
      expect(headerContainer).toHaveStyle({
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        zIndex: "100",
        margin: "0",
      });
    });

    it("marks its frame for what hangs below it: windows that open at a fixed place, and the Table menu", () => {
      const { container } = render(<Header {...props} />);
      expect(container.firstChild).toHaveAttribute("data-header-root");
    });

    it("should render with bevel panel and flexbox layout", () => {
      render(<Header {...props} />);
      const bevelPanel = screen.getByTestId("jrpg-panel-bevel");
      const flexContainer = bevelPanel.querySelector("div") as HTMLElement;

      expect(bevelPanel).toBeInTheDocument();
      expect(bevelPanel).toHaveStyle({
        padding: "6px 10px",
        borderRadius: "0",
      });
      expect(flexContainer).toHaveStyle({
        display: "flex",
        gap: "12px",
        alignItems: "center",
        flexWrap: "wrap",
      });
    });

    it("should render left and right panels with correct styling", () => {
      render(<Header {...props} />);
      const simplePanels = screen.getAllByTestId("jrpg-panel-simple");
      const leftPanel = simplePanels[0];
      const rightPanel = simplePanels[1];
      const controlsContainer = rightPanel.querySelector("div") as HTMLElement;

      expect(leftPanel).toHaveStyle({
        padding: "6px 10px",
        minWidth: "180px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      });
      expect(rightPanel).toHaveStyle({
        padding: "6px 10px",
        flex: "1",
        display: "flex",
        alignItems: "center",
      });
      expect(controlsContainer).toHaveStyle({
        display: "flex",
        gap: "8px",
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
          padding: "4px 10px",
        });
      });
    });
  });

  describe("Logo and the Table button", () => {
    it("should render logo with correct attributes and styling", () => {
      render(<Header {...props} />);
      const logo = screen.getByAltText("HeroByte");

      expect(logo).toBeInTheDocument();
      // The WIDE mark: at 32px tall the square version would leave the
      // lettering only ~16px high, since both now letterbox the same wordmark.
      expect(logo).toHaveAttribute("src", "/logo-wide.webp");
      expect(logo).toHaveAttribute("alt", "HeroByte");
      expect(logo).toHaveClass("jrpg-pixelated");
      expect(logo).toHaveStyle({ height: "32px" });
    });

    it("puts the Table button beside the logo, in the left block where the UID used to be", () => {
      render(<Header {...props} />);
      const leftPanel = screen.getAllByTestId("jrpg-panel-simple")[0];
      expect(leftPanel).toContainElement(screen.getByAltText("HeroByte"));
      expect(leftPanel).toContainElement(screen.getByTestId("table-menu"));
    });

    it("hands the Table button the table's own object, unchanged", () => {
      render(<Header {...props} table={tableMenu({ tableName: "Friday", isDM: true })} />);
      const menu = screen.getByTestId("table-menu");
      expect(menu).toHaveTextContent("Friday");
      expect(menu).toHaveAttribute("data-dm", "true");
    });

    it("prints no UID and no connection words of its own: the Table button carries both", () => {
      render(<Header {...props} />);
      expect(screen.queryByText("UID", { selector: "strong" })).toBeNull();
      expect(screen.queryByText(/12345678/)).toBeNull();
      expect(screen.queryByText(/ONLINE|OFFLINE/)).toBeNull();
    });

    it("follows the table object when it changes", () => {
      const { rerender } = render(<Header {...props} table={tableMenu({ tableName: "One" })} />);
      expect(screen.getByTestId("table-menu")).toHaveTextContent("One");
      rerender(<Header {...props} table={tableMenu({ tableName: "Two", isConnected: false })} />);
      expect(screen.getByTestId("table-menu")).toHaveTextContent("Two");
      expect(screen.getByTestId("table-menu")).toHaveAttribute("data-connected", "false");
    });
  });

  describe("Preferences moved out (U9)", () => {
    it("has no CRT or Juice button: Display and Sound & motion are in the Table menu", () => {
      render(<Header {...props} />);
      expect(screen.queryByRole("button", { name: /CRT/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Juice/ })).toBeNull();
    });
  });

  describe("The public table's warning", () => {
    it("is a row of the header on the public test table, in its flow", () => {
      render(<Header {...props} table={tableMenu({ isPublicTable: true })} />);
      const chip = screen.getByTestId("public-table-chip");
      const bevelPanel = screen.getByTestId("jrpg-panel-bevel");
      expect(bevelPanel).toContainElement(chip);
      // First in the header's panel, above the tool rows, never a fixed overlay.
      expect(bevelPanel.firstElementChild).toBe(chip);
    });

    it("is absent on a private table", () => {
      render(<Header {...props} table={tableMenu({ isPublicTable: false })} />);
      expect(screen.queryByTestId("public-table-chip")).toBeNull();
    });
  });

  describe("The gate's reconnect notice", () => {
    it("does not host it: the layout places it outside the header's own layer", () => {
      // Inside the header it would share the header's z-index 100, and a floating window opened
      // at the right edge would paint over the words that say the table is away.
      const { container } = render(
        <ReconnectPhaseContext.Provider value="reconnecting">
          <Header {...props} />
        </ReconnectPhaseContext.Provider>,
      );
      expect(container.querySelector("[data-header-root]")).not.toBeNull();
      expect(screen.queryByTestId("reconnect-notice")).toBeNull();
    });
  });

  describe("Ref Attachment", () => {
    it("should attach topPanelRef to container div when provided", () => {
      const topPanelRef = React.createRef<HTMLDivElement>();
      render(<Header {...props} topPanelRef={topPanelRef} />);

      expect(topPanelRef.current).toBeInTheDocument();
      expect(topPanelRef.current).toHaveStyle({
        position: "fixed",
        top: "0",
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
    { tool: "pointer", label: "👆 Ping" },
    { tool: "measure", label: "📏 Measure" },
    { tool: "draw", label: "✏️ Draw" },
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
        screen.getByRole("button", { name: "👆 Ping" }),
        screen.getByRole("button", { name: "📏 Measure" }),
        screen.getByRole("button", { name: "✏️ Draw" }),
        screen.getByRole("button", { name: "🔄 Transform" }),
        screen.getByRole("button", { name: "🖱️ Select" }),
      ];

      allButtons.forEach((btn) => expect(btn).toHaveAttribute("data-variant", "default"));

      rerender(<Header {...props} activeTool="pointer" />);
      expect(screen.getByRole("button", { name: "👆 Ping" })).toHaveAttribute(
        "data-variant",
        "primary",
      );
      allButtons.slice(1).forEach((btn) => expect(btn).toHaveAttribute("data-variant", "default"));
    });

    it("should handle non-displayed tool modes (align)", () => {
      render(<Header {...props} activeTool={"align" as ToolMode} />);
      const allButtons = [
        screen.getByRole("button", { name: "👆 Ping" }),
        screen.getByRole("button", { name: "📏 Measure" }),
        screen.getByRole("button", { name: "✏️ Draw" }),
        screen.getByRole("button", { name: "🔄 Transform" }),
        screen.getByRole("button", { name: "🖱️ Select" }),
      ];

      allButtons.forEach((btn) => expect(btn).toHaveAttribute("data-variant", "default"));
    });

    it("should switch between different tool modes correctly", () => {
      const { rerender } = render(<Header {...props} activeTool="pointer" />);
      expect(screen.getByRole("button", { name: "👆 Ping" })).toHaveAttribute(
        "data-variant",
        "primary",
      );

      rerender(<Header {...props} activeTool="measure" />);
      expect(screen.getByRole("button", { name: "📏 Measure" })).toHaveAttribute(
        "data-variant",
        "primary",
      );

      rerender(<Header {...props} activeTool="draw" />);
      expect(screen.getByRole("button", { name: "✏️ Draw" })).toHaveAttribute(
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
    prop: "diceRollerOpen" | "rollLogOpen";
    label: string;
    handler: string;
  }>([
    { prop: "diceRollerOpen", label: "⚂ Dice", handler: "onDiceRollerToggle" },
    { prop: "rollLogOpen", label: "📜 Chat & Rolls", handler: "onRollLogToggle" },
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
          excluded: ["onToolSelect", "onDiceRollerToggle", "onRollLogToggle", "onResetCamera"],
        },
        {
          name: "👆 Ping",
          handler: "onToolSelect",
          excluded: [
            "onSnapToGridChange",
            "onDiceRollerToggle",
            "onRollLogToggle",
            "onResetCamera",
          ],
        },
        {
          name: "⚂ Dice",
          handler: "onDiceRollerToggle",
          excluded: ["onSnapToGridChange", "onToolSelect", "onRollLogToggle", "onResetCamera"],
        },
        {
          name: "📜 Chat & Rolls",
          handler: "onRollLogToggle",
          excluded: ["onSnapToGridChange", "onToolSelect", "onDiceRollerToggle", "onResetCamera"],
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
            (val as { mockClear: () => void }).mockClear();
          }
        });
      });
    });
  });

  describe("Component Re-rendering", () => {
    it("keeps its tools live while the table object changes under it", () => {
      const { rerender } = render(<Header {...props} activeTool="draw" />);
      rerender(<Header {...props} activeTool="draw" table={tableMenu({ tableName: "Other" })} />);
      expect(screen.getByRole("button", { name: "✏️ Draw" })).toHaveAttribute(
        "data-variant",
        "primary",
      );
    });
  });
});
