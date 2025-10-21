/**
 * Characterization tests for CenterCanvasLayout section of MainLayout
 *
 * These tests capture the behavior of lines 566-605 in MainLayout.tsx BEFORE extraction.
 * They serve as regression tests to ensure no behavioral changes occur during refactoring.
 *
 * Source: apps/client/src/layouts/MainLayout.tsx (lines 566-605)
 * Target: Future CenterCanvasLayout component
 *
 * Components tested:
 * - Fixed-position wrapper div with dynamic top/bottom spacing
 * - MapBoard component with all 26+ required props
 *
 * Part of: MainLayout decomposition project (785 LOC → <200 LOC)
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AlignmentPoint, AlignmentSuggestion } from "../../types/alignment";
import type { CameraCommand } from "../../ui/MapBoard";
import type { Camera } from "../../hooks/useCamera";

// Mock MapBoard component with detailed prop tracking
vi.mock("../../ui/MapBoard", () => ({
  default: (props: {
    snapshot: unknown;
    sendMessage: unknown;
    uid: string;
    gridSize: number;
    snapToGrid: boolean;
    pointerMode: boolean;
    measureMode: boolean;
    drawMode: boolean;
    transformMode: boolean;
    selectMode: boolean;
    isDM: boolean;
    alignmentMode: boolean;
    alignmentPoints?: AlignmentPoint[];
    alignmentSuggestion?: AlignmentSuggestion | null;
    onAlignmentPointCapture?: (point: AlignmentPoint) => void;
    drawTool: "freehand" | "line" | "rect" | "circle" | "eraser";
    drawColor: string;
    drawWidth: number;
    drawOpacity: number;
    drawFilled: boolean;
    onDrawingComplete: (id: string) => void;
    onRecolorToken: (sceneId: string, owner?: string | null) => void;
    onTransformObject: (input: {
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
    }) => void;
    cameraCommand: CameraCommand | null;
    onCameraCommandHandled: () => void;
    onCameraChange?: (camera: Camera) => void;
    selectedObjectId?: string | null;
    selectedObjectIds?: string[];
    onSelectObject?: (objectId: string | null) => void;
    onSelectObjects?: (objectIds: string[]) => void;
  }) => (
    <div
      data-testid="map-board"
      data-uid={props.uid}
      data-grid-size={props.gridSize}
      data-snap-to-grid={props.snapToGrid}
      data-pointer-mode={props.pointerMode}
      data-measure-mode={props.measureMode}
      data-draw-mode={props.drawMode}
      data-transform-mode={props.transformMode}
      data-select-mode={props.selectMode}
      data-is-dm={props.isDM}
      data-alignment-mode={props.alignmentMode}
      data-alignment-points-count={props.alignmentPoints?.length ?? 0}
      data-alignment-suggestion-present={
        props.alignmentSuggestion !== null && props.alignmentSuggestion !== undefined
      }
      data-draw-tool={props.drawTool}
      data-draw-color={props.drawColor}
      data-draw-width={props.drawWidth}
      data-draw-opacity={props.drawOpacity}
      data-draw-filled={props.drawFilled}
      data-camera-command-type={props.cameraCommand?.type ?? "null"}
      data-selected-object-id={props.selectedObjectId ?? "null"}
      data-selected-objects-count={props.selectedObjectIds?.length ?? 0}
      data-snapshot-present={props.snapshot !== null && props.snapshot !== undefined}
    >
      MapBoard
    </div>
  ),
}));

// Mock other components that are not part of CenterCanvasLayout but required by MainLayout
vi.mock("../../components/layout/ServerStatus", () => ({
  ServerStatus: () => <div data-testid="server-status">ServerStatus</div>,
}));

vi.mock("../../features/drawing/components", () => ({
  DrawingToolbar: () => <div data-testid="drawing-toolbar">DrawingToolbar</div>,
}));

vi.mock("../../components/layout/Header", () => ({
  Header: () => <div data-testid="header">Header</div>,
}));

vi.mock("../../components/layout/MultiSelectToolbar", () => ({
  MultiSelectToolbar: () => <div data-testid="multi-select-toolbar">MultiSelectToolbar</div>,
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

describe("CenterCanvasLayout Section - Characterization Tests", () => {
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
      canUndo: false,
      canRedo: false,
      onToolChange: vi.fn(),
      onColorChange: vi.fn(),
      onWidthChange: vi.fn(),
      onOpacityChange: vi.fn(),
      onFilledChange: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onClearAll: vi.fn(),
      onClose: vi.fn(),
    },
    drawingProps: {
      drawTool: "freehand" as const,
      drawColor: "#000000",
      drawWidth: 2,
      drawOpacity: 1,
      drawFilled: false,
      onDrawingComplete: vi.fn(),
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

    // Room Password
    roomPasswordStatus: null,
    roomPasswordPending: false,
    handleSetRoomPassword: vi.fn(),
    dismissRoomPasswordStatus: vi.fn(),

    // NPC Management
    handleCreateNPC: vi.fn(),
    handleUpdateNPC: vi.fn(),
    handleDeleteNPC: vi.fn(),
    handlePlaceNPCToken: vi.fn(),
    handleDeletePlayerToken: vi.fn(),

    // Prop Management
    handleCreateProp: vi.fn(),
    handleUpdateProp: vi.fn(),
    handleDeleteProp: vi.fn(),

    // Session Management
    handleSaveSession: vi.fn(),
    handleLoadSession: vi.fn(),

    // DM Management
    handleToggleDM: vi.fn(),
    setMapBackgroundURL: vi.fn(),
    setGridSize: vi.fn(),
    setGridSquareSize: vi.fn(),

    // Toast
    toast: {
      messages: [],
      dismiss: vi.fn(),
    },

    // WebSocket
    sendMessage: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Wrapper Div Rendering Tests
  // ============================================================================

  describe("Wrapper div rendering", () => {
    it("should render the fixed-position wrapper div", () => {
      const props = createDefaultProps();
      const { container } = render(<MainLayout {...props} />);

      // Find the wrapper div by its distinctive styling
      const wrapperDivs = Array.from(container.querySelectorAll("div")).filter((div) => {
        const style = div.getAttribute("style");
        return style && style.includes("position: fixed");
      });

      // Should find at least one fixed-position div (the canvas wrapper)
      expect(wrapperDivs.length).toBeGreaterThan(0);
    });

    it("should apply position: fixed to wrapper div", () => {
      const props = createDefaultProps();
      const { container } = render(<MainLayout {...props} />);

      // Find the MapBoard wrapper (parent of MapBoard component)
      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper).toBeTruthy();
      expect(wrapper?.style.position).toBe("fixed");
    });

    it("should apply overflow: hidden to wrapper div", () => {
      const props = createDefaultProps();
      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.overflow).toBe("hidden");
    });

    it("should apply left: 0 and right: 0 to wrapper div", () => {
      const props = createDefaultProps();
      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.left).toBe("0px");
      expect(wrapper?.style.right).toBe("0px");
    });
  });

  // ============================================================================
  // Dynamic Positioning Tests
  // ============================================================================

  describe("Dynamic positioning with topHeight and bottomHeight", () => {
    it("should apply top spacing using topHeight prop", () => {
      const props = createDefaultProps();
      props.topHeight = 180;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.top).toBe("180px");
    });

    it("should apply bottom spacing using bottomHeight prop", () => {
      const props = createDefaultProps();
      props.bottomHeight = 210;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.bottom).toBe("210px");
    });

    it("should update positioning when topHeight changes", () => {
      const props = createDefaultProps();
      props.topHeight = 100;

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      let wrapper = mapBoard.parentElement;
      expect(wrapper?.style.top).toBe("100px");

      // Update topHeight
      props.topHeight = 250;
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      wrapper = mapBoard.parentElement;
      expect(wrapper?.style.top).toBe("250px");
    });

    it("should update positioning when bottomHeight changes", () => {
      const props = createDefaultProps();
      props.bottomHeight = 100;

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      let wrapper = mapBoard.parentElement;
      expect(wrapper?.style.bottom).toBe("100px");

      // Update bottomHeight
      props.bottomHeight = 300;
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      wrapper = mapBoard.parentElement;
      expect(wrapper?.style.bottom).toBe("300px");
    });

    it("should handle topHeight of 0", () => {
      const props = createDefaultProps();
      props.topHeight = 0;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.top).toBe("0px");
    });

    it("should handle bottomHeight of 0", () => {
      const props = createDefaultProps();
      props.bottomHeight = 0;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.bottom).toBe("0px");
    });

    it("should handle various topHeight values", () => {
      const heights = [0, 50, 100, 200, 500];

      heights.forEach((height) => {
        const props = createDefaultProps();
        props.topHeight = height;

        const { unmount } = render(<MainLayout {...props} />);

        const mapBoard = screen.getByTestId("map-board");
        const wrapper = mapBoard.parentElement;

        expect(wrapper?.style.top).toBe(`${height}px`);

        unmount();
      });
    });

    it("should handle various bottomHeight values", () => {
      const heights = [0, 100, 250, 500];

      heights.forEach((height) => {
        const props = createDefaultProps();
        props.bottomHeight = height;

        const { unmount } = render(<MainLayout {...props} />);

        const mapBoard = screen.getByTestId("map-board");
        const wrapper = mapBoard.parentElement;

        expect(wrapper?.style.bottom).toBe(`${height}px`);

        unmount();
      });
    });

    it("should handle both topHeight and bottomHeight simultaneously", () => {
      const props = createDefaultProps();
      props.topHeight = 150;
      props.bottomHeight = 250;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.top).toBe("150px");
      expect(wrapper?.style.bottom).toBe("250px");
    });
  });

  // ============================================================================
  // MapBoard Component Rendering
  // ============================================================================

  describe("MapBoard component rendering", () => {
    it("should always render MapBoard component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("map-board")).toBeInTheDocument();
    });

    it("should render MapBoard inside the wrapper div", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.position).toBe("fixed");
    });
  });

  // ============================================================================
  // Core Data Props Tests
  // ============================================================================

  describe("Core data props pass-through", () => {
    it("should pass snapshot prop to MapBoard", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-snapshot-present", "false");
    });

    it("should pass non-null snapshot to MapBoard", () => {
      const props = createDefaultProps();
      props.snapshot = {
        players: [],
        characters: [],
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
      };

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-snapshot-present", "true");
    });

    it("should pass uid prop to MapBoard", () => {
      const props = createDefaultProps();
      props.uid = "test-user-123";

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-uid", "test-user-123");
    });

    it("should pass gridSize prop to MapBoard", () => {
      const props = createDefaultProps();
      props.gridSize = 75;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-grid-size", "75");
    });

    it("should pass snapToGrid prop to MapBoard", () => {
      const props = createDefaultProps();
      props.snapToGrid = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-snap-to-grid", "true");
    });

    it("should pass snapToGrid=false to MapBoard", () => {
      const props = createDefaultProps();
      props.snapToGrid = false;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-snap-to-grid", "false");
    });

    it("should pass isDM prop to MapBoard", () => {
      const props = createDefaultProps();
      props.isDM = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-is-dm", "true");
    });

    it("should pass isDM=false to MapBoard", () => {
      const props = createDefaultProps();
      props.isDM = false;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-is-dm", "false");
    });
  });

  // ============================================================================
  // Tool Mode Props Tests
  // ============================================================================

  describe("Tool mode props pass-through", () => {
    it("should pass pointerMode prop to MapBoard", () => {
      const props = createDefaultProps();
      props.pointerMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-pointer-mode", "true");
    });

    it("should pass measureMode prop to MapBoard", () => {
      const props = createDefaultProps();
      props.measureMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-measure-mode", "true");
    });

    it("should pass drawMode prop to MapBoard", () => {
      const props = createDefaultProps();
      props.drawMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "true");
    });

    it("should pass transformMode prop to MapBoard", () => {
      const props = createDefaultProps();
      props.transformMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-transform-mode", "true");
    });

    it("should pass selectMode prop to MapBoard", () => {
      const props = createDefaultProps();
      props.selectMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-select-mode", "true");
    });

    it("should pass alignmentMode prop to MapBoard", () => {
      const props = createDefaultProps();
      props.alignmentMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-mode", "true");
    });

    it("should pass all tool modes as false when inactive", () => {
      const props = createDefaultProps();
      props.pointerMode = false;
      props.measureMode = false;
      props.drawMode = false;
      props.transformMode = false;
      props.selectMode = false;
      props.alignmentMode = false;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-pointer-mode", "false");
      expect(mapBoard).toHaveAttribute("data-measure-mode", "false");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "false");
      expect(mapBoard).toHaveAttribute("data-transform-mode", "false");
      expect(mapBoard).toHaveAttribute("data-select-mode", "false");
      expect(mapBoard).toHaveAttribute("data-alignment-mode", "false");
    });

    it("should update tool modes when they change", () => {
      const props = createDefaultProps();
      props.drawMode = false;

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "false");

      props.drawMode = true;
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "true");
    });
  });

  // ============================================================================
  // Selection Props Tests
  // ============================================================================

  describe("Selection props pass-through", () => {
    it("should pass null selectedObjectId to MapBoard", () => {
      const props = createDefaultProps();
      props.selectedObjectId = null;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-object-id", "null");
    });

    it("should pass non-null selectedObjectId to MapBoard", () => {
      const props = createDefaultProps();
      props.selectedObjectId = "token-123";

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-object-id", "token-123");
    });

    it("should pass empty selectedObjectIds to MapBoard", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = [];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-objects-count", "0");
    });

    it("should pass populated selectedObjectIds to MapBoard", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = ["obj-1", "obj-2", "obj-3"];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-objects-count", "3");
    });

    it("should pass single selected object in array", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = ["single-obj"];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-objects-count", "1");
    });
  });

  // ============================================================================
  // Camera Props Tests
  // ============================================================================

  describe("Camera props pass-through", () => {
    it("should pass null cameraCommand to MapBoard", () => {
      const props = createDefaultProps();
      props.cameraCommand = null;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "null");
    });

    it("should pass focus-token cameraCommand to MapBoard", () => {
      const props = createDefaultProps();
      props.cameraCommand = { type: "focus-token", tokenId: "token-123" };

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "focus-token");
    });

    it("should pass reset cameraCommand to MapBoard", () => {
      const props = createDefaultProps();
      props.cameraCommand = { type: "reset" };

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "reset");
    });

    it("should update cameraCommand when it changes", () => {
      const props = createDefaultProps();
      props.cameraCommand = null;

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "null");

      props.cameraCommand = { type: "reset" };
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "reset");
    });
  });

  // ============================================================================
  // Alignment Props Tests
  // ============================================================================

  describe("Alignment props pass-through", () => {
    it("should pass empty alignmentPoints array to MapBoard", () => {
      const props = createDefaultProps();
      props.alignmentPoints = [];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-points-count", "0");
    });

    it("should pass populated alignmentPoints to MapBoard", () => {
      const props = createDefaultProps();
      props.alignmentPoints = [
        { world: { x: 0, y: 0 }, local: { x: 0, y: 0 } },
        { world: { x: 100, y: 100 }, local: { x: 50, y: 50 } },
      ];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-points-count", "2");
    });

    it("should pass null alignmentSuggestion to MapBoard", () => {
      const props = createDefaultProps();
      props.alignmentSuggestion = null;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-suggestion-present", "false");
    });

    it("should pass non-null alignmentSuggestion to MapBoard", () => {
      const props = createDefaultProps();
      props.alignmentSuggestion = {
        position: { x: 100, y: 100 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      };

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-suggestion-present", "true");
    });
  });

  // ============================================================================
  // Drawing Props Tests (Spread Operator)
  // ============================================================================

  describe("Drawing props pass-through via spread operator", () => {
    it("should pass drawTool from drawingProps to MapBoard", () => {
      const props = createDefaultProps();
      props.drawingProps.drawTool = "freehand";

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-tool", "freehand");
    });

    it("should pass all drawTool types to MapBoard", () => {
      const drawTools: Array<"freehand" | "line" | "rect" | "circle" | "eraser"> = [
        "freehand",
        "line",
        "rect",
        "circle",
        "eraser",
      ];

      drawTools.forEach((tool) => {
        const props = createDefaultProps();
        props.drawingProps.drawTool = tool;

        const { unmount } = render(<MainLayout {...props} />);

        const mapBoard = screen.getByTestId("map-board");
        expect(mapBoard).toHaveAttribute("data-draw-tool", tool);

        unmount();
      });
    });

    it("should pass drawColor from drawingProps to MapBoard", () => {
      const props = createDefaultProps();
      props.drawingProps.drawColor = "#ff0000";

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-color", "#ff0000");
    });

    it("should pass drawWidth from drawingProps to MapBoard", () => {
      const props = createDefaultProps();
      props.drawingProps.drawWidth = 5;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-width", "5");
    });

    it("should pass drawOpacity from drawingProps to MapBoard", () => {
      const props = createDefaultProps();
      props.drawingProps.drawOpacity = 0.7;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-opacity", "0.7");
    });

    it("should pass drawFilled from drawingProps to MapBoard", () => {
      const props = createDefaultProps();
      props.drawingProps.drawFilled = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-filled", "true");
    });

    it("should pass drawFilled=false from drawingProps to MapBoard", () => {
      const props = createDefaultProps();
      props.drawingProps.drawFilled = false;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-filled", "false");
    });

    it("should update drawing props when they change", () => {
      const props = createDefaultProps();
      props.drawingProps = {
        drawTool: "freehand",
        drawColor: "#000000",
        drawWidth: 2,
        drawOpacity: 1,
        drawFilled: false,
        onDrawingComplete: vi.fn(),
      };

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-color", "#000000");
      expect(mapBoard).toHaveAttribute("data-draw-width", "2");

      // Create new object reference to trigger React.memo re-render
      props.drawingProps = {
        drawTool: "freehand",
        drawColor: "#0000ff",
        drawWidth: 8,
        drawOpacity: 1,
        drawFilled: false,
        onDrawingComplete: vi.fn(),
      };
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-color", "#0000ff");
      expect(mapBoard).toHaveAttribute("data-draw-width", "8");
    });

    it("should pass all drawing props correctly in one test", () => {
      const props = createDefaultProps();
      props.drawingProps = {
        drawTool: "circle",
        drawColor: "#00ff00",
        drawWidth: 3,
        drawOpacity: 0.5,
        drawFilled: true,
        onDrawingComplete: vi.fn(),
      };

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-tool", "circle");
      expect(mapBoard).toHaveAttribute("data-draw-color", "#00ff00");
      expect(mapBoard).toHaveAttribute("data-draw-width", "3");
      expect(mapBoard).toHaveAttribute("data-draw-opacity", "0.5");
      expect(mapBoard).toHaveAttribute("data-draw-filled", "true");
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle null snapshot", () => {
      const props = createDefaultProps();
      props.snapshot = null;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-snapshot-present", "false");
    });

    it("should handle empty selectedObjectIds array", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = [];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-objects-count", "0");
    });

    it("should handle null cameraCommand", () => {
      const props = createDefaultProps();
      props.cameraCommand = null;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "null");
    });

    it("should handle null alignmentSuggestion", () => {
      const props = createDefaultProps();
      props.alignmentSuggestion = null;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-suggestion-present", "false");
    });

    it("should handle empty alignmentPoints array", () => {
      const props = createDefaultProps();
      props.alignmentPoints = [];

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-alignment-points-count", "0");
    });

    it("should handle very long uid", () => {
      const props = createDefaultProps();
      props.uid = "a".repeat(1000);

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-uid", "a".repeat(1000));
    });

    it("should handle negative topHeight", () => {
      const props = createDefaultProps();
      props.topHeight = -50;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.top).toBe("-50px");
    });

    it("should handle negative bottomHeight", () => {
      const props = createDefaultProps();
      props.bottomHeight = -100;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.bottom).toBe("-100px");
    });

    it("should handle very large gridSize", () => {
      const props = createDefaultProps();
      props.gridSize = 999999;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-grid-size", "999999");
    });

    it("should handle gridSize of 0", () => {
      const props = createDefaultProps();
      props.gridSize = 0;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-grid-size", "0");
    });

    it("should handle many selected objects", () => {
      const props = createDefaultProps();
      props.selectedObjectIds = Array.from({ length: 100 }, (_, i) => `obj-${i}`);

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-selected-objects-count", "100");
    });

    it("should handle all tool modes active simultaneously", () => {
      const props = createDefaultProps();
      props.pointerMode = true;
      props.measureMode = true;
      props.drawMode = true;
      props.transformMode = true;
      props.selectMode = true;
      props.alignmentMode = true;

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-pointer-mode", "true");
      expect(mapBoard).toHaveAttribute("data-measure-mode", "true");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "true");
      expect(mapBoard).toHaveAttribute("data-transform-mode", "true");
      expect(mapBoard).toHaveAttribute("data-select-mode", "true");
      expect(mapBoard).toHaveAttribute("data-alignment-mode", "true");
    });

    it("should handle extreme topHeight and bottomHeight values", () => {
      const props = createDefaultProps();
      props.topHeight = 9999;
      props.bottomHeight = 9999;

      const { container } = render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      expect(wrapper?.style.top).toBe("9999px");
      expect(wrapper?.style.bottom).toBe("9999px");
    });

    it("should maintain wrapper structure when all props change", () => {
      const props = createDefaultProps();
      props.topHeight = 100;
      props.bottomHeight = 150;

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      let wrapper = mapBoard.parentElement;
      expect(wrapper?.style.position).toBe("fixed");
      expect(wrapper?.style.overflow).toBe("hidden");

      // Update all props
      props.topHeight = 300;
      props.bottomHeight = 400;
      props.uid = "new-uid";
      props.gridSize = 100;
      props.snapToGrid = false;
      props.isDM = true;

      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      wrapper = mapBoard.parentElement;
      expect(wrapper?.style.position).toBe("fixed");
      expect(wrapper?.style.overflow).toBe("hidden");
      expect(wrapper?.style.top).toBe("300px");
      expect(wrapper?.style.bottom).toBe("400px");
    });
  });

  // ============================================================================
  // Handler Props Tests
  // ============================================================================

  describe("Handler props pass-through", () => {
    it("should pass all required handler props to MapBoard", () => {
      const props = createDefaultProps();
      const mockHandlers = {
        sendMessage: vi.fn(),
        handleAlignmentPointCapture: vi.fn(),
        recolorToken: vi.fn(),
        transformSceneObject: vi.fn(),
        handleCameraCommandHandled: vi.fn(),
        setCameraState: vi.fn(),
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      };

      Object.assign(props, mockHandlers);

      render(<MainLayout {...props} />);

      // MapBoard should be rendered (handlers are passed but not visible in DOM)
      expect(screen.getByTestId("map-board")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration tests", () => {
    it("should render MapBoard with all 26+ props in a realistic scenario", () => {
      const props = createDefaultProps();

      // Realistic scenario: DM mode with active drawing and some selected objects
      props.isDM = true;
      props.drawMode = true;
      props.snapToGrid = true;
      props.gridSize = 50;
      props.uid = "dm-user-123";
      props.selectedObjectIds = ["token-1", "token-2"];
      props.selectedObjectId = "token-1";
      props.drawingProps = {
        drawTool: "circle",
        drawColor: "#ff0000",
        drawWidth: 3,
        drawOpacity: 0.8,
        drawFilled: true,
        onDrawingComplete: vi.fn(),
      };
      props.alignmentPoints = [{ world: { x: 0, y: 0 }, local: { x: 0, y: 0 } }];
      props.cameraCommand = { type: "reset" };
      props.topHeight = 180;
      props.bottomHeight = 210;
      props.snapshot = {
        players: [],
        characters: [],
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
      };

      render(<MainLayout {...props} />);

      const mapBoard = screen.getByTestId("map-board");
      const wrapper = mapBoard.parentElement;

      // Verify wrapper
      expect(wrapper?.style.position).toBe("fixed");
      expect(wrapper?.style.top).toBe("180px");
      expect(wrapper?.style.bottom).toBe("210px");
      expect(wrapper?.style.overflow).toBe("hidden");

      // Verify MapBoard props
      expect(mapBoard).toHaveAttribute("data-is-dm", "true");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "true");
      expect(mapBoard).toHaveAttribute("data-snap-to-grid", "true");
      expect(mapBoard).toHaveAttribute("data-grid-size", "50");
      expect(mapBoard).toHaveAttribute("data-uid", "dm-user-123");
      expect(mapBoard).toHaveAttribute("data-selected-objects-count", "2");
      expect(mapBoard).toHaveAttribute("data-selected-object-id", "token-1");
      expect(mapBoard).toHaveAttribute("data-draw-tool", "circle");
      expect(mapBoard).toHaveAttribute("data-draw-color", "#ff0000");
      expect(mapBoard).toHaveAttribute("data-draw-width", "3");
      expect(mapBoard).toHaveAttribute("data-draw-opacity", "0.8");
      expect(mapBoard).toHaveAttribute("data-draw-filled", "true");
      expect(mapBoard).toHaveAttribute("data-alignment-points-count", "1");
      expect(mapBoard).toHaveAttribute("data-camera-command-type", "reset");
      expect(mapBoard).toHaveAttribute("data-snapshot-present", "true");
    });

    it("should maintain correct rendering when switching between tool modes", () => {
      const props = createDefaultProps();
      props.pointerMode = true;
      props.drawMode = false;

      const { rerender } = render(<MainLayout {...props} />);

      let mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-pointer-mode", "true");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "false");

      // Switch to draw mode
      props.pointerMode = false;
      props.drawMode = true;
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-pointer-mode", "false");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "true");

      // Switch to measure mode
      props.drawMode = false;
      props.measureMode = true;
      rerender(<MainLayout {...props} />);

      mapBoard = screen.getByTestId("map-board");
      expect(mapBoard).toHaveAttribute("data-draw-mode", "false");
      expect(mapBoard).toHaveAttribute("data-measure-mode", "true");
    });
  });
});
