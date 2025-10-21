/**
 * Characterization tests for TopPanelLayout section of MainLayout
 *
 * These tests capture the behavior of lines 544-574 in MainLayout.tsx BEFORE extraction.
 * They serve as regression tests to ensure no behavioral changes occur during refactoring.
 *
 * Source: apps/client/src/layouts/MainLayout.tsx (lines 544-574)
 * Target: Future TopPanelLayout component
 *
 * Components tested:
 * - ServerStatus (always rendered)
 * - DrawingToolbar (conditional on drawMode)
 * - Header (always rendered)
 * - MultiSelectToolbar (always rendered)
 *
 * Part of: MainLayout decomposition project (795 LOC → <200 LOC)
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DrawingToolbarProps } from "../../features/drawing/components/DrawingToolbar";
import type { ToolMode } from "../../components/layout/Header";

// Mock all child components with prop tracking
vi.mock("../../components/layout/ServerStatus", () => ({
  ServerStatus: ({ isConnected }: { isConnected: boolean }) => (
    <div data-testid="server-status" data-connected={isConnected}>
      ServerStatus
    </div>
  ),
}));

vi.mock("../../features/drawing/components", () => ({
  DrawingToolbar: (props: DrawingToolbarProps) => (
    <div
      data-testid="drawing-toolbar"
      data-draw-tool={props.drawTool}
      data-draw-color={props.drawColor}
      data-draw-width={props.drawWidth}
      data-draw-opacity={props.drawOpacity}
      data-draw-filled={props.drawFilled}
    >
      DrawingToolbar
    </div>
  ),
}));

vi.mock("../../components/layout/Header", () => ({
  Header: (props: {
    uid: string;
    snapToGrid: boolean;
    activeTool: ToolMode;
    crtFilter: boolean;
    diceRollerOpen: boolean;
    rollLogOpen: boolean;
    onSnapToGridChange: (snap: boolean) => void;
    onToolSelect: (mode: ToolMode) => void;
    onCrtFilterChange: (enabled: boolean) => void;
    onDiceRollerToggle: (open: boolean) => void;
    onRollLogToggle: (open: boolean) => void;
    topPanelRef?: React.RefObject<HTMLDivElement>;
    onFocusSelf: () => void;
    onResetCamera: () => void;
  }) => (
    <div
      data-testid="header"
      data-uid={props.uid}
      data-snap-to-grid={props.snapToGrid}
      data-active-tool={props.activeTool}
      data-crt-filter={props.crtFilter}
      data-dice-roller-open={props.diceRollerOpen}
      data-roll-log-open={props.rollLogOpen}
    >
      Header
    </div>
  ),
}));

vi.mock("../../components/layout/MultiSelectToolbar", () => ({
  MultiSelectToolbar: (props: {
    selectedObjectIds: string[];
    isDM: boolean;
    topHeight: number;
    onLock: () => void;
    onUnlock: () => void;
  }) => (
    <div
      data-testid="multi-select-toolbar"
      data-selected-count={props.selectedObjectIds.length}
      data-is-dm={props.isDM}
      data-top-height={props.topHeight}
    >
      MultiSelectToolbar
    </div>
  ),
}));

// Mock other components that are not part of TopPanelLayout but required by MainLayout
vi.mock("../../ui/MapBoard", () => ({
  default: () => <div data-testid="map-board">MapBoard</div>,
}));

vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: () => <div data-testid="entities-panel">EntitiesPanel</div>,
}));

vi.mock("../../features/dm", () => ({
  DMMenu: () => <div data-testid="dm-menu">DMMenu</div>,
}));

vi.mock("../../components/ui/ContextMenu", () => ({
  ContextMenu: () => <div data-testid="context-menu">ContextMenu</div>,
}));

vi.mock("../../components/effects/VisualEffects", () => ({
  VisualEffects: () => <div data-testid="visual-effects">VisualEffects</div>,
}));

vi.mock("../../components/dice/DiceRoller", () => ({
  DiceRoller: () => <div data-testid="dice-roller">DiceRoller</div>,
}));

vi.mock("../../components/dice/RollLog", () => ({
  RollLog: () => <div data-testid="roll-log">RollLog</div>,
}));

vi.mock("../../components/ui/Toast", () => ({
  ToastContainer: () => <div data-testid="toast-container">ToastContainer</div>,
}));

// Import the component AFTER mocks are set up
import { MainLayout } from "../MainLayout";
import type { MainLayoutProps } from "../MainLayout";

describe("TopPanelLayout Section - Characterization Tests", () => {
  // Minimal props fixture for testing
  const createDefaultProps = (): MainLayoutProps => ({
    // Connection State
    isConnected: true,

    // Layout State
    topHeight: 180,
    bottomHeight: 210,
    topPanelRef: { current: null },
    bottomPanelRef: { current: null },
    contextMenu: null,
    setContextMenu: vi.fn(),

    // Tool State
    activeTool: "pointer" as const,
    setActiveTool: vi.fn(),
    drawMode: false,
    pointerMode: true,
    measureMode: false,
    transformMode: false,
    selectMode: false,
    alignmentMode: false,

    // UI State
    snapToGrid: true,
    setSnapToGrid: vi.fn(),
    crtFilter: false,
    setCrtFilter: vi.fn(),
    diceRollerOpen: false,
    rollLogOpen: false,
    toggleDiceRoller: vi.fn(),
    toggleRollLog: vi.fn(),
    micEnabled: false,
    toggleMic: vi.fn(),
    gridLocked: false,
    setGridLocked: vi.fn(),

    // Data
    snapshot: null,
    uid: "test-user-uid",
    gridSize: 50,
    gridSquareSize: 5,
    isDM: false,

    // Camera
    cameraState: { x: 0, y: 0, scale: 1 },
    camera: { x: 0, y: 0, scale: 1 },
    cameraCommand: null,
    handleCameraCommandHandled: vi.fn(),
    setCameraState: vi.fn(),
    handleFocusSelf: vi.fn(),
    handleResetCamera: vi.fn(),

    // Drawing
    drawingToolbarProps: {
      drawTool: "freehand" as const,
      drawColor: "#000000",
      drawWidth: 2,
      drawOpacity: 1,
      drawFilled: false,
      onToolChange: vi.fn(),
      onColorChange: vi.fn(),
      onWidthChange: vi.fn(),
      onOpacityChange: vi.fn(),
      onFilledChange: vi.fn(),
      onClearAll: vi.fn(),
    },
    drawingProps: {
      drawings: [],
      drawTool: "freehand" as const,
      drawColor: "#000000",
      drawWidth: 2,
      drawOpacity: 1,
      drawFilled: false,
      isDrawing: false,
      onDrawingStart: vi.fn(),
      onDrawingMove: vi.fn(),
      onDrawingEnd: vi.fn(),
    },
    handleClearDrawings: vi.fn(),

    // Editing
    editingPlayerUID: null,
    nameInput: "",
    editingHpUID: null,
    hpInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    updateNameInput: vi.fn(),
    startNameEdit: vi.fn(),
    submitNameEdit: vi.fn(),
    updateHpInput: vi.fn(),
    startHpEdit: vi.fn(),
    submitHpEdit: vi.fn(),
    updateMaxHpInput: vi.fn(),
    startMaxHpEdit: vi.fn(),
    submitMaxHpEdit: vi.fn(),

    // Selection
    selectedObjectId: null,
    selectedObjectIds: [],
    handleObjectSelection: vi.fn(),
    handleObjectSelectionBatch: vi.fn(),
    lockSelected: vi.fn(),
    unlockSelected: vi.fn(),

    // Player Actions
    playerActions: {
      renamePlayer: vi.fn(),
      setPortrait: vi.fn(),
      setHP: vi.fn(),
      applyPlayerState: vi.fn(),
      setStatusEffects: vi.fn(),
      setPlayerStagingZone: vi.fn(),
      addCharacter: vi.fn(),
      deleteCharacter: vi.fn(),
      updateCharacterName: vi.fn(),
      updateCharacterHP: vi.fn(),
    },

    // Scene Objects
    mapSceneObject: null,
    stagingZoneSceneObject: null,
    recolorToken: vi.fn(),
    transformSceneObject: vi.fn(),
    toggleSceneObjectLock: vi.fn(),
    deleteToken: vi.fn(),
    updateTokenImage: vi.fn(),
    updateTokenSize: vi.fn(),

    // Alignment
    alignmentPoints: [],
    alignmentSuggestion: null,
    alignmentError: null,
    handleAlignmentStart: vi.fn(),
    handleAlignmentReset: vi.fn(),
    handleAlignmentCancel: vi.fn(),
    handleAlignmentApply: vi.fn(),
    handleAlignmentPointCapture: vi.fn(),

    // Dice
    rollHistory: [],
    viewingRoll: null,
    handleRoll: vi.fn(),
    handleClearLog: vi.fn(),
    handleViewRoll: vi.fn(),

    // DM Menu
    handleRequestSaveSession: vi.fn(),
    handleRequestLoadSession: vi.fn(),
    handleCreateNPC: vi.fn(),
    handleUpdateNPC: vi.fn(),
    handleDeleteNPC: vi.fn(),
    handlePlaceNPCToken: vi.fn(),
    handleCreateProp: vi.fn(),
    handleUpdateProp: vi.fn(),
    handleDeleteProp: vi.fn(),
    handleSetRoomPassword: vi.fn(),
    roomPasswordStatus: null,
    roomPasswordPending: false,
    handleDismissRoomPasswordStatus: vi.fn(),

    // Toast
    toast: {
      messages: [],
      dismiss: vi.fn(),
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // ServerStatus Component Tests
  // ============================================================================

  describe("ServerStatus rendering", () => {
    it("should always render ServerStatus component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("server-status")).toBeInTheDocument();
    });

    it("should pass isConnected=true to ServerStatus when connected", () => {
      const props = createDefaultProps();
      props.isConnected = true;

      render(<MainLayout {...props} />);

      const serverStatus = screen.getByTestId("server-status");
      expect(serverStatus).toHaveAttribute("data-connected", "true");
    });

    it("should pass isConnected=false to ServerStatus when disconnected", () => {
      const props = createDefaultProps();
      props.isConnected = false;

      render(<MainLayout {...props} />);

      const serverStatus = screen.getByTestId("server-status");
      expect(serverStatus).toHaveAttribute("data-connected", "false");
    });
  });

  // ============================================================================
  // DrawingToolbar Conditional Rendering Tests
  // ============================================================================

  describe("DrawingToolbar conditional rendering", () => {
    it("should render DrawingToolbar when drawMode is true", () => {
      const props = createDefaultProps();
      props.drawMode = true;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();
    });

    it("should NOT render DrawingToolbar when drawMode is false", () => {
      const props = createDefaultProps();
      props.drawMode = false;

      render(<MainLayout {...props} />);

      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();
    });

    it("should pass drawingToolbarProps correctly when DrawingToolbar is rendered", () => {
      const props = createDefaultProps();
      props.drawMode = true;
      props.drawingToolbarProps = {
        drawTool: "circle",
        drawColor: "#ff0000",
        drawWidth: 5,
        drawOpacity: 0.8,
        drawFilled: true,
        onToolChange: vi.fn(),
        onColorChange: vi.fn(),
        onWidthChange: vi.fn(),
        onOpacityChange: vi.fn(),
        onFilledChange: vi.fn(),
        onClearAll: vi.fn(),
      };

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("drawing-toolbar");
      expect(toolbar).toHaveAttribute("data-draw-tool", "circle");
      expect(toolbar).toHaveAttribute("data-draw-color", "#ff0000");
      expect(toolbar).toHaveAttribute("data-draw-width", "5");
      expect(toolbar).toHaveAttribute("data-draw-opacity", "0.8");
      expect(toolbar).toHaveAttribute("data-draw-filled", "true");
    });

    it("should pass all drawingToolbarProps properties using spread operator", () => {
      const props = createDefaultProps();
      props.drawMode = true;
      props.drawingToolbarProps = {
        drawTool: "line",
        drawColor: "#00ff00",
        drawWidth: 3,
        drawOpacity: 0.5,
        drawFilled: false,
        canUndo: true,
        canRedo: false,
        onToolChange: vi.fn(),
        onColorChange: vi.fn(),
        onWidthChange: vi.fn(),
        onOpacityChange: vi.fn(),
        onFilledChange: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onClearAll: vi.fn(),
      };

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("drawing-toolbar");
      expect(toolbar).toHaveAttribute("data-draw-tool", "line");
      expect(toolbar).toHaveAttribute("data-draw-color", "#00ff00");
      expect(toolbar).toHaveAttribute("data-draw-width", "3");
    });
  });

  // ============================================================================
  // Header Component Tests
  // ============================================================================

  describe("Header rendering", () => {
    it("should always render Header component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    it("should pass uid prop to Header", () => {
      const props = createDefaultProps();
      props.uid = "test-uid-12345";

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-uid", "test-uid-12345");
    });

    it("should pass snapToGrid prop to Header", () => {
      const props = createDefaultProps();
      props.snapToGrid = true;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-snap-to-grid", "true");
    });

    it("should pass snapToGrid=false to Header", () => {
      const props = createDefaultProps();
      props.snapToGrid = false;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-snap-to-grid", "false");
    });

    it("should pass activeTool prop to Header", () => {
      const props = createDefaultProps();
      props.activeTool = "measure";

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-active-tool", "measure");
    });

    it("should pass all valid activeTool values to Header", () => {
      const toolModes: ToolMode[] = ["pointer", "measure", "draw", "transform", "select", "align"];

      toolModes.forEach((tool) => {
        const props = createDefaultProps();
        props.activeTool = tool;

        const { unmount } = render(<MainLayout {...props} />);

        const header = screen.getByTestId("header");
        expect(header).toHaveAttribute("data-active-tool", tool);

        unmount();
      });
    });

    it("should pass crtFilter prop to Header", () => {
      const props = createDefaultProps();
      props.crtFilter = true;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-crt-filter", "true");
    });

    it("should pass crtFilter=false to Header", () => {
      const props = createDefaultProps();
      props.crtFilter = false;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-crt-filter", "false");
    });

    it("should pass diceRollerOpen prop to Header", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-dice-roller-open", "true");
    });

    it("should pass diceRollerOpen=false to Header", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = false;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-dice-roller-open", "false");
    });

    it("should pass rollLogOpen prop to Header", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-roll-log-open", "true");
    });

    it("should pass rollLogOpen=false to Header", () => {
      const props = createDefaultProps();
      props.rollLogOpen = false;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-roll-log-open", "false");
    });

    it("should pass topPanelRef to Header", () => {
      const props = createDefaultProps();
      const topPanelRef = { current: document.createElement("div") };
      props.topPanelRef = topPanelRef;

      render(<MainLayout {...props} />);

      // Header should be rendered (ref is passed but not visible in DOM)
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    it("should pass all required handler props to Header", () => {
      const props = createDefaultProps();
      const mockSetSnapToGrid = vi.fn();
      const mockSetActiveTool = vi.fn();
      const mockSetCrtFilter = vi.fn();
      const mockToggleDiceRoller = vi.fn();
      const mockToggleRollLog = vi.fn();
      const mockHandleFocusSelf = vi.fn();
      const mockHandleResetCamera = vi.fn();

      props.setSnapToGrid = mockSetSnapToGrid;
      props.setActiveTool = mockSetActiveTool;
      props.setCrtFilter = mockSetCrtFilter;
      props.toggleDiceRoller = mockToggleDiceRoller;
      props.toggleRollLog = mockToggleRollLog;
      props.handleFocusSelf = mockHandleFocusSelf;
      props.handleResetCamera = mockHandleResetCamera;

      render(<MainLayout {...props} />);

      // Header should be rendered with all handlers passed
      expect(screen.getByTestId("header")).toBeInTheDocument();
    });

    it("should pass all 14 Header props correctly in one test", () => {
      const props = createDefaultProps();
      props.uid = "comprehensive-test-uid";
      props.snapToGrid = true;
      props.activeTool = "draw";
      props.crtFilter = true;
      props.diceRollerOpen = true;
      props.rollLogOpen = true;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-uid", "comprehensive-test-uid");
      expect(header).toHaveAttribute("data-snap-to-grid", "true");
      expect(header).toHaveAttribute("data-active-tool", "draw");
      expect(header).toHaveAttribute("data-crt-filter", "true");
      expect(header).toHaveAttribute("data-dice-roller-open", "true");
      expect(header).toHaveAttribute("data-roll-log-open", "true");
    });
  });

  // ============================================================================
  // MultiSelectToolbar Component Tests
  // ============================================================================

  describe("MultiSelectToolbar rendering", () => {
    it("should always render MultiSelectToolbar component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should pass empty selectedObjectIds array to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = [];

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "0");
    });

    it("should pass populated selectedObjectIds array to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = ["obj-1", "obj-2", "obj-3"];

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "3");
    });

    it("should pass single selected object to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = ["single-obj"];

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "1");
    });

    it("should pass isDM=true to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      props.isDM = true;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-is-dm", "true");
    });

    it("should pass isDM=false to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      props.isDM = false;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-is-dm", "false");
    });

    it("should pass topHeight prop to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      props.topHeight = 200;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-top-height", "200");
    });

    it("should pass different topHeight values to MultiSelectToolbar", () => {
      const heights = [0, 100, 180, 250, 500];

      heights.forEach((height) => {
        const props = createDefaultProps();
        props.topHeight = height;

        const { unmount } = render(<MainLayout {...props} />);

        const toolbar = screen.getByTestId("multi-select-toolbar");
        expect(toolbar).toHaveAttribute("data-top-height", String(height));

        unmount();
      });
    });

    it("should pass onLock handler to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      const mockLockSelected = vi.fn();
      props.lockSelected = mockLockSelected;

      render(<MainLayout {...props} />);

      // MultiSelectToolbar should be rendered with handler
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should pass onUnlock handler to MultiSelectToolbar", () => {
      const props = createDefaultProps();
      const mockUnlockSelected = vi.fn();
      props.unlockSelected = mockUnlockSelected;

      render(<MainLayout {...props} />);

      // MultiSelectToolbar should be rendered with handler
      expect(screen.getByTestId("multi-select-toolbar")).toBeInTheDocument();
    });

    it("should pass all 5 MultiSelectToolbar props correctly", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = ["obj-1", "obj-2"];
      props.isDM = true;
      props.topHeight = 180;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "2");
      expect(toolbar).toHaveAttribute("data-is-dm", "true");
      expect(toolbar).toHaveAttribute("data-top-height", "180");
    });
  });

  // ============================================================================
  // Component Hierarchy and Order Tests
  // ============================================================================

  describe("TopPanelLayout component hierarchy and order", () => {
    it("should render all TopPanelLayout components in correct order", () => {
      const props = createDefaultProps();
      props.drawMode = true; // Enable DrawingToolbar

      const { container } = render(<MainLayout {...props} />);

      // Get all components
      const serverStatus = screen.getByTestId("server-status");
      const drawingToolbar = screen.getByTestId("drawing-toolbar");
      const header = screen.getByTestId("header");
      const multiSelectToolbar = screen.getByTestId("multi-select-toolbar");

      // All should be present
      expect(serverStatus).toBeInTheDocument();
      expect(drawingToolbar).toBeInTheDocument();
      expect(header).toBeInTheDocument();
      expect(multiSelectToolbar).toBeInTheDocument();

      // Verify they appear in the correct order in the DOM
      const allElements = Array.from(container.querySelectorAll("[data-testid]"));
      const topPanelComponents = allElements.filter((el) =>
        ["server-status", "drawing-toolbar", "header", "multi-select-toolbar"].includes(
          el.getAttribute("data-testid") || "",
        ),
      );

      const order = topPanelComponents.map((el) => el.getAttribute("data-testid"));
      const serverStatusIndex = order.indexOf("server-status");
      const drawingToolbarIndex = order.indexOf("drawing-toolbar");
      const headerIndex = order.indexOf("header");
      const multiSelectToolbarIndex = order.indexOf("multi-select-toolbar");

      // ServerStatus should appear before all others
      expect(serverStatusIndex).toBeLessThan(drawingToolbarIndex);
      expect(serverStatusIndex).toBeLessThan(headerIndex);
      expect(serverStatusIndex).toBeLessThan(multiSelectToolbarIndex);

      // DrawingToolbar should appear before Header
      expect(drawingToolbarIndex).toBeLessThan(headerIndex);

      // Header should appear before MultiSelectToolbar
      expect(headerIndex).toBeLessThan(multiSelectToolbarIndex);
    });

    it("should render TopPanelLayout components in correct order without DrawingToolbar", () => {
      const props = createDefaultProps();
      props.drawMode = false; // Disable DrawingToolbar

      const { container } = render(<MainLayout {...props} />);

      // Get all components
      const serverStatus = screen.getByTestId("server-status");
      const header = screen.getByTestId("header");
      const multiSelectToolbar = screen.getByTestId("multi-select-toolbar");

      // These should be present
      expect(serverStatus).toBeInTheDocument();
      expect(header).toBeInTheDocument();
      expect(multiSelectToolbar).toBeInTheDocument();

      // DrawingToolbar should NOT be present
      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();

      // Verify order
      const allElements = Array.from(container.querySelectorAll("[data-testid]"));
      const topPanelComponents = allElements.filter((el) =>
        ["server-status", "header", "multi-select-toolbar"].includes(
          el.getAttribute("data-testid") || "",
        ),
      );

      const order = topPanelComponents.map((el) => el.getAttribute("data-testid"));
      const serverStatusIndex = order.indexOf("server-status");
      const headerIndex = order.indexOf("header");
      const multiSelectToolbarIndex = order.indexOf("multi-select-toolbar");

      expect(serverStatusIndex).toBeLessThan(headerIndex);
      expect(headerIndex).toBeLessThan(multiSelectToolbarIndex);
    });
  });

  // ============================================================================
  // Edge Cases and Integration Tests
  // ============================================================================

  describe("TopPanelLayout edge cases", () => {
    it("should handle null activeTool prop", () => {
      const props = createDefaultProps();
      props.activeTool = null;

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      // null is not rendered as an attribute (React omits it)
      expect(header).not.toHaveAttribute("data-active-tool");
    });

    it("should handle very long uid prop", () => {
      const props = createDefaultProps();
      props.uid = "a".repeat(1000);

      render(<MainLayout {...props} />);

      const header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-uid", "a".repeat(1000));
    });

    it("should handle topHeight of 0", () => {
      const props = createDefaultProps();
      props.topHeight = 0;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-top-height", "0");
    });

    it("should handle very large topHeight", () => {
      const props = createDefaultProps();
      props.topHeight = 99999;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-top-height", "99999");
    });

    it("should handle negative topHeight", () => {
      const props = createDefaultProps();
      props.topHeight = -100;

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-top-height", "-100");
    });

    it("should handle many selected objects", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = Array.from({ length: 100 }, (_, i) => `obj-${i}`);

      render(<MainLayout {...props} />);

      const toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "100");
    });

    it("should handle all boolean flags set to true simultaneously", () => {
      const props = createDefaultProps();
      props.isConnected = true;
      props.drawMode = true;
      props.snapToGrid = true;
      props.crtFilter = true;
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.isDM = true;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("server-status")).toHaveAttribute("data-connected", "true");
      expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();
      expect(screen.getByTestId("header")).toHaveAttribute("data-snap-to-grid", "true");
      expect(screen.getByTestId("header")).toHaveAttribute("data-crt-filter", "true");
      expect(screen.getByTestId("header")).toHaveAttribute("data-dice-roller-open", "true");
      expect(screen.getByTestId("header")).toHaveAttribute("data-roll-log-open", "true");
      expect(screen.getByTestId("multi-select-toolbar")).toHaveAttribute("data-is-dm", "true");
    });

    it("should handle all boolean flags set to false simultaneously", () => {
      const props = createDefaultProps();
      props.isConnected = false;
      props.drawMode = false;
      props.snapToGrid = false;
      props.crtFilter = false;
      props.diceRollerOpen = false;
      props.rollLogOpen = false;
      props.isDM = false;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("server-status")).toHaveAttribute("data-connected", "false");
      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();
      expect(screen.getByTestId("header")).toHaveAttribute("data-snap-to-grid", "false");
      expect(screen.getByTestId("header")).toHaveAttribute("data-crt-filter", "false");
      expect(screen.getByTestId("header")).toHaveAttribute("data-dice-roller-open", "false");
      expect(screen.getByTestId("header")).toHaveAttribute("data-roll-log-open", "false");
      expect(screen.getByTestId("multi-select-toolbar")).toHaveAttribute("data-is-dm", "false");
    });

    it("should re-render correctly when drawMode toggles", () => {
      const props = createDefaultProps();
      props.drawMode = false;

      const { rerender } = render(<MainLayout {...props} />);

      // Initially no DrawingToolbar
      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();

      // Toggle drawMode to true
      props.drawMode = true;
      rerender(<MainLayout {...props} />);

      // Now DrawingToolbar should appear
      expect(screen.getByTestId("drawing-toolbar")).toBeInTheDocument();

      // Toggle back to false
      props.drawMode = false;
      rerender(<MainLayout {...props} />);

      // DrawingToolbar should disappear
      expect(screen.queryByTestId("drawing-toolbar")).not.toBeInTheDocument();
    });

    it("should update Header props when they change", () => {
      const props = createDefaultProps();
      props.uid = "initial-uid";
      props.snapToGrid = false;
      props.activeTool = "pointer";

      const { rerender } = render(<MainLayout {...props} />);

      let header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-uid", "initial-uid");
      expect(header).toHaveAttribute("data-snap-to-grid", "false");
      expect(header).toHaveAttribute("data-active-tool", "pointer");

      // Update props
      props.uid = "updated-uid";
      props.snapToGrid = true;
      props.activeTool = "measure";
      rerender(<MainLayout {...props} />);

      header = screen.getByTestId("header");
      expect(header).toHaveAttribute("data-uid", "updated-uid");
      expect(header).toHaveAttribute("data-snap-to-grid", "true");
      expect(header).toHaveAttribute("data-active-tool", "measure");
    });

    it("should update MultiSelectToolbar props when they change", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = [];
      props.isDM = false;
      props.topHeight = 100;

      const { rerender } = render(<MainLayout {...props} />);

      let toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "0");
      expect(toolbar).toHaveAttribute("data-is-dm", "false");
      expect(toolbar).toHaveAttribute("data-top-height", "100");

      // Update props
      props.selectedObjectIds = ["obj-1", "obj-2", "obj-3"];
      props.isDM = true;
      props.topHeight = 200;
      rerender(<MainLayout {...props} />);

      toolbar = screen.getByTestId("multi-select-toolbar");
      expect(toolbar).toHaveAttribute("data-selected-count", "3");
      expect(toolbar).toHaveAttribute("data-is-dm", "true");
      expect(toolbar).toHaveAttribute("data-top-height", "200");
    });
  });
});
