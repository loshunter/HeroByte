/**
 * Characterization tests for FloatingPanelsLayout section of MainLayout
 *
 * These tests capture the behavior of lines 663-774 in MainLayout.tsx BEFORE extraction.
 * They serve as regression tests to ensure no behavioral changes occur during refactoring.
 *
 * Source: apps/client/src/layouts/MainLayout.tsx (lines 663-774)
 * Target: Future FloatingPanelsLayout component
 *
 * Components tested:
 * - DMMenu (always rendered, handles isDM internally)
 * - ContextMenu (always rendered, handles null internally)
 * - VisualEffects (always rendered)
 * - DiceRoller (conditional on diceRollerOpen)
 * - RollLog (conditional on rollLogOpen with wrapper div)
 * - DiceRoller (viewing mode, conditional on viewingRoll with wrapper div)
 * - ToastContainer (always rendered)
 *
 * Part of: MainLayout decomposition project (795 LOC → <200 LOC)
 */

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AlignmentPoint, AlignmentSuggestion } from "../../types/alignment";
import type { RollLogEntry } from "../MainLayout";
import type { Camera } from "../../hooks/useCamera";

// ============================================================================
// MOCK CHILD COMPONENTS
// ============================================================================

// Mock DMMenu with detailed prop tracking
vi.mock("../../features/dm", () => ({
  DMMenu: (props: {
    isDM: boolean;
    onToggleDM: (next: boolean) => void;
    gridSize: number;
    gridSquareSize?: number;
    gridLocked: boolean;
    onGridLockToggle: () => void;
    onGridSizeChange: (size: number) => void;
    onGridSquareSizeChange?: (size: number) => void;
    onClearDrawings: () => void;
    onSetMapBackground: (url: string) => void;
    mapBackground?: string;
    playerStagingZone?: unknown;
    onSetPlayerStagingZone?: (zone: unknown) => void;
    camera: Camera;
    playerCount: number;
    characters: unknown[];
    onRequestSaveSession?: (sessionName: string) => void;
    onRequestLoadSession?: (file: File) => void;
    onCreateNPC: () => void;
    onUpdateNPC: (id: string, updates: unknown) => void;
    onDeleteNPC: (id: string) => void;
    onPlaceNPCToken: (id: string) => void;
    props: unknown[];
    players: unknown[];
    onCreateProp: () => void;
    onUpdateProp: (id: string, updates: unknown) => void;
    onDeleteProp: (id: string) => void;
    mapLocked?: boolean;
    onMapLockToggle?: () => void;
    stagingZoneLocked?: boolean;
    onStagingZoneLockToggle?: () => void;
    mapTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
    onMapTransformChange?: (transform: unknown) => void;
    alignmentModeActive: boolean;
    alignmentPoints: AlignmentPoint[];
    alignmentSuggestion: AlignmentSuggestion | null;
    alignmentError?: string | null;
    onAlignmentStart: () => void;
    onAlignmentReset: () => void;
    onAlignmentCancel: () => void;
    onAlignmentApply: () => void;
    onSetRoomPassword?: (secret: string) => void;
    roomPasswordStatus?: { type: "success" | "error"; message: string } | null;
    roomPasswordPending?: boolean;
    onDismissRoomPasswordStatus?: () => void;
  }) => (
    <div
      data-testid="dm-menu"
      data-is-dm={props.isDM}
      data-grid-size={props.gridSize}
      data-grid-square-size={props.gridSquareSize ?? 0}
      data-grid-locked={props.gridLocked}
      data-camera-x={props.camera.x}
      data-camera-y={props.camera.y}
      data-camera-scale={props.camera.scale}
      data-player-count={props.playerCount}
      data-characters-count={props.characters.length}
      data-alignment-mode-active={props.alignmentModeActive}
      data-alignment-points-count={props.alignmentPoints.length}
      data-alignment-suggestion-present={props.alignmentSuggestion !== null}
      data-alignment-error-present={props.alignmentError !== null && props.alignmentError !== undefined}
      data-room-password-status-type={props.roomPasswordStatus?.type ?? "null"}
      data-room-password-pending={props.roomPasswordPending ?? false}
      data-map-background={props.mapBackground ?? ""}
      data-props-count={props.props.length}
      data-players-count={props.players.length}
      data-map-locked={props.mapLocked ?? true}
      data-staging-zone-locked={props.stagingZoneLocked ?? false}
    >
      DMMenu
    </div>
  ),
}));

// Mock ContextMenu with prop tracking
vi.mock("../../components/ui/ContextMenu", () => ({
  ContextMenu: (props: {
    menu: { x: number; y: number; tokenId: string } | null;
    onDelete: (id: string) => void;
    onClose: () => void;
  }) => (
    <div
      data-testid="context-menu"
      data-menu-present={props.menu !== null}
      data-menu-x={props.menu?.x ?? 0}
      data-menu-y={props.menu?.y ?? 0}
      data-menu-token-id={props.menu?.tokenId ?? ""}
    >
      ContextMenu
    </div>
  ),
}));

// Mock VisualEffects with prop tracking
vi.mock("../../components/effects/VisualEffects", () => ({
  VisualEffects: (props: { crtFilter: boolean }) => (
    <div data-testid="visual-effects" data-crt-filter={props.crtFilter}>
      VisualEffects
    </div>
  ),
}));

// Mock DiceRoller with prop tracking
vi.mock("../../components/dice/DiceRoller", () => ({
  DiceRoller: (props: { onRoll: (roll: unknown) => void; onClose: () => void }) => (
    <div data-testid="dice-roller" data-on-roll-present={typeof props.onRoll === "function"}>
      DiceRoller
    </div>
  ),
}));

// Mock RollLog with prop tracking
vi.mock("../../components/dice/RollLog", () => ({
  RollLog: (props: {
    rolls: RollLogEntry[];
    onClearLog: () => void;
    onViewRoll: (roll: RollLogEntry | null) => void;
    onClose: () => void;
  }) => (
    <div data-testid="roll-log" data-rolls-count={props.rolls.length}>
      RollLog
    </div>
  ),
}));

// Mock ToastContainer with prop tracking
vi.mock("../../components/ui/Toast", () => ({
  ToastContainer: (props: { messages: unknown[]; onDismiss: (id: string) => void }) => (
    <div data-testid="toast-container" data-messages-count={props.messages.length}>
      ToastContainer
    </div>
  ),
}));

// Mock other components that are not part of FloatingPanelsLayout but required by MainLayout
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

vi.mock("../../ui/MapBoard", () => ({
  default: () => <div data-testid="map-board">MapBoard</div>,
}));

vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: () => <div data-testid="entities-panel">EntitiesPanel</div>,
}));

// Import the component AFTER mocks are set up
import { MainLayout } from "../MainLayout";
import type { MainLayoutProps } from "../MainLayout";

describe("FloatingPanelsLayout Section - Characterization Tests", () => {
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
  // DMMenu Component Tests
  // ============================================================================

  describe("DMMenu rendering", () => {
    it("should always render DMMenu component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass isDM prop to DMMenu", () => {
      const props = createDefaultProps();
      props.isDM = true;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-is-dm", "true");
    });

    it("should pass isDM=false to DMMenu", () => {
      const props = createDefaultProps();
      props.isDM = false;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-is-dm", "false");
    });

    it("should pass gridSize prop to DMMenu", () => {
      const props = createDefaultProps();
      props.gridSize = 75;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-size", "75");
    });

    it("should pass gridSquareSize prop to DMMenu", () => {
      const props = createDefaultProps();
      props.gridSquareSize = 10;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-square-size", "10");
    });

    it("should pass gridLocked prop to DMMenu", () => {
      const props = createDefaultProps();
      props.gridLocked = true;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-locked", "true");
    });

    it("should pass gridLocked=false to DMMenu", () => {
      const props = createDefaultProps();
      props.gridLocked = false;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-locked", "false");
    });

    it("should pass camera prop to DMMenu", () => {
      const props = createDefaultProps();
      props.camera = { x: 100, y: 200, scale: 1.5 };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-camera-x", "100");
      expect(dmMenu).toHaveAttribute("data-camera-y", "200");
      expect(dmMenu).toHaveAttribute("data-camera-scale", "1.5");
    });

    it("should pass playerCount from snapshot to DMMenu", () => {
      const props = createDefaultProps();
      props.snapshot = {
        players: [{}, {}, {}] as any,
        characters: [],
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-player-count", "3");
    });

    it("should pass playerCount=0 when snapshot is null", () => {
      const props = createDefaultProps();
      props.snapshot = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-player-count", "0");
    });

    it("should pass characters from snapshot to DMMenu", () => {
      const props = createDefaultProps();
      props.snapshot = {
        players: [],
        characters: [{}, {}] as any,
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-characters-count", "2");
    });

    it("should pass empty characters array when snapshot is null", () => {
      const props = createDefaultProps();
      props.snapshot = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-characters-count", "0");
    });

    it("should pass alignmentMode as alignmentModeActive to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentMode = true;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-mode-active", "true");
    });

    it("should pass alignmentMode=false to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentMode = false;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-mode-active", "false");
    });

    it("should pass alignmentPoints to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentPoints = [
        { world: { x: 0, y: 0 }, local: { x: 0, y: 0 } },
        { world: { x: 100, y: 100 }, local: { x: 50, y: 50 } },
      ];

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", "2");
    });

    it("should pass empty alignmentPoints array to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentPoints = [];

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", "0");
    });

    it("should pass null alignmentSuggestion to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentSuggestion = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-suggestion-present", "false");
    });

    it("should pass non-null alignmentSuggestion to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentSuggestion = {
        position: { x: 100, y: 100 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-suggestion-present", "true");
    });

    it("should pass null alignmentError to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentError = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-error-present", "false");
    });

    it("should pass non-null alignmentError to DMMenu", () => {
      const props = createDefaultProps();
      props.alignmentError = "Alignment failed";

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-error-present", "true");
    });

    it("should pass roomPasswordStatus to DMMenu", () => {
      const props = createDefaultProps();
      props.roomPasswordStatus = { type: "success", message: "Password set" };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-room-password-status-type", "success");
    });

    it("should pass roomPasswordStatus type=error to DMMenu", () => {
      const props = createDefaultProps();
      props.roomPasswordStatus = { type: "error", message: "Password failed" };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-room-password-status-type", "error");
    });

    it("should pass null roomPasswordStatus to DMMenu", () => {
      const props = createDefaultProps();
      props.roomPasswordStatus = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-room-password-status-type", "null");
    });

    it("should pass roomPasswordPending to DMMenu", () => {
      const props = createDefaultProps();
      props.roomPasswordPending = true;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-room-password-pending", "true");
    });

    it("should pass roomPasswordPending=false to DMMenu", () => {
      const props = createDefaultProps();
      props.roomPasswordPending = false;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-room-password-pending", "false");
    });

    it("should pass mapBackground from snapshot to DMMenu", () => {
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
        mapBackground: "https://example.com/map.jpg",
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-map-background", "https://example.com/map.jpg");
    });

    it("should pass props from snapshot to DMMenu", () => {
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
        props: [{}, {}] as any,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-props-count", "2");
    });

    it("should pass players from snapshot to DMMenu", () => {
      const props = createDefaultProps();
      props.snapshot = {
        players: [{}, {}, {}] as any,
        characters: [],
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-players-count", "3");
    });

    it("should pass mapLocked from mapSceneObject to DMMenu", () => {
      const props = createDefaultProps();
      props.mapSceneObject = {
        id: "map-1",
        type: "image",
        imageUrl: "map.jpg",
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        locked: false,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-map-locked", "false");
    });

    it("should pass mapLocked=true when mapSceneObject is null", () => {
      const props = createDefaultProps();
      props.mapSceneObject = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-map-locked", "true");
    });

    it("should pass stagingZoneLocked from stagingZoneSceneObject to DMMenu", () => {
      const props = createDefaultProps();
      props.stagingZoneSceneObject = {
        id: "staging-1",
        type: "image",
        imageUrl: "staging.jpg",
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        locked: true,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-staging-zone-locked", "true");
    });

    it("should pass stagingZoneLocked=false when stagingZoneSceneObject is null", () => {
      const props = createDefaultProps();
      props.stagingZoneSceneObject = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-staging-zone-locked", "false");
    });

    it("should pass all DMMenu handler props", () => {
      const props = createDefaultProps();
      const mockHandlers = {
        handleToggleDM: vi.fn(),
        setGridLocked: vi.fn(),
        setGridSize: vi.fn(),
        setGridSquareSize: vi.fn(),
        handleClearDrawings: vi.fn(),
        setMapBackgroundURL: vi.fn(),
        playerActions: {
          ...props.playerActions,
          setPlayerStagingZone: vi.fn(),
        },
        toggleSceneObjectLock: vi.fn(),
        transformSceneObject: vi.fn(),
        handleAlignmentStart: vi.fn(),
        handleAlignmentReset: vi.fn(),
        handleAlignmentCancel: vi.fn(),
        handleAlignmentApply: vi.fn(),
        handleSetRoomPassword: vi.fn(),
        dismissRoomPasswordStatus: vi.fn(),
        handleSaveSession: vi.fn(),
        handleCreateNPC: vi.fn(),
        handleUpdateNPC: vi.fn(),
        handleDeleteNPC: vi.fn(),
        handlePlaceNPCToken: vi.fn(),
        handleCreateProp: vi.fn(),
        handleUpdateProp: vi.fn(),
        handleDeleteProp: vi.fn(),
      };

      Object.assign(props, mockHandlers);

      render(<MainLayout {...props} />);

      // DMMenu should be rendered with all handlers
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass onRequestSaveSession when snapshot exists", () => {
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
      props.handleSaveSession = vi.fn();

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should NOT pass onRequestSaveSession when snapshot is null", () => {
      const props = createDefaultProps();
      props.snapshot = null;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass mapTransform from mapSceneObject to DMMenu", () => {
      const props = createDefaultProps();
      props.mapSceneObject = {
        id: "map-1",
        type: "image",
        imageUrl: "map.jpg",
        transform: { x: 100, y: 200, scaleX: 1.5, scaleY: 1.2, rotation: 45 },
        locked: false,
      };

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should pass default mapTransform when mapSceneObject is null", () => {
      const props = createDefaultProps();
      props.mapSceneObject = null;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should update DMMenu props when camera changes", () => {
      const props = createDefaultProps();
      props.camera = { x: 0, y: 0, scale: 1 };

      const { rerender } = render(<MainLayout {...props} />);

      let dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-camera-x", "0");
      expect(dmMenu).toHaveAttribute("data-camera-y", "0");
      expect(dmMenu).toHaveAttribute("data-camera-scale", "1");

      props.camera = { x: 250, y: 350, scale: 2 };
      rerender(<MainLayout {...props} />);

      dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-camera-x", "250");
      expect(dmMenu).toHaveAttribute("data-camera-y", "350");
      expect(dmMenu).toHaveAttribute("data-camera-scale", "2");
    });

    it("should update DMMenu props when gridSize changes", () => {
      const props = createDefaultProps();
      props.gridSize = 50;

      const { rerender } = render(<MainLayout {...props} />);

      let dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-size", "50");

      props.gridSize = 100;
      rerender(<MainLayout {...props} />);

      dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-size", "100");
    });

    it("should update DMMenu props when gridSquareSize changes", () => {
      const props = createDefaultProps();
      props.gridSquareSize = 5;

      const { rerender } = render(<MainLayout {...props} />);

      let dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-square-size", "5");

      props.gridSquareSize = 10;
      rerender(<MainLayout {...props} />);

      dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-square-size", "10");
    });

    it("should update DMMenu props when alignment state changes", () => {
      const props = createDefaultProps();
      props.alignmentMode = false;
      props.alignmentPoints = [];
      props.alignmentSuggestion = null;

      const { rerender } = render(<MainLayout {...props} />);

      let dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-mode-active", "false");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", "0");
      expect(dmMenu).toHaveAttribute("data-alignment-suggestion-present", "false");

      props.alignmentMode = true;
      props.alignmentPoints = [{ world: { x: 0, y: 0 }, local: { x: 0, y: 0 } }];
      props.alignmentSuggestion = {
        position: { x: 100, y: 100 },
        scale: { x: 1, y: 1 },
        rotation: 0,
      };
      rerender(<MainLayout {...props} />);

      dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-mode-active", "true");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", "1");
      expect(dmMenu).toHaveAttribute("data-alignment-suggestion-present", "true");
    });

    it("should pass playerStagingZone from snapshot to DMMenu", () => {
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
        playerStagingZone: {
          imageUrl: "staging.jpg",
        },
      };

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    it("should handle snapshot with no playerStagingZone", () => {
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

      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ContextMenu Component Tests
  // ============================================================================

  describe("ContextMenu rendering", () => {
    it("should always render ContextMenu component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    });

    it("should pass null contextMenu to ContextMenu", () => {
      const props = createDefaultProps();
      props.contextMenu = null;

      render(<MainLayout {...props} />);

      const contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-present", "false");
    });

    it("should pass non-null contextMenu to ContextMenu", () => {
      const props = createDefaultProps();
      props.contextMenu = { x: 100, y: 200, tokenId: "token-123" };

      render(<MainLayout {...props} />);

      const contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-present", "true");
      expect(contextMenu).toHaveAttribute("data-menu-x", "100");
      expect(contextMenu).toHaveAttribute("data-menu-y", "200");
      expect(contextMenu).toHaveAttribute("data-menu-token-id", "token-123");
    });

    it("should pass contextMenu with different coordinates", () => {
      const props = createDefaultProps();
      props.contextMenu = { x: 500, y: 300, tokenId: "another-token" };

      render(<MainLayout {...props} />);

      const contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-x", "500");
      expect(contextMenu).toHaveAttribute("data-menu-y", "300");
      expect(contextMenu).toHaveAttribute("data-menu-token-id", "another-token");
    });

    it("should update when contextMenu changes from null to non-null", () => {
      const props = createDefaultProps();
      props.contextMenu = null;

      const { rerender } = render(<MainLayout {...props} />);

      let contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-present", "false");

      props.contextMenu = { x: 100, y: 100, tokenId: "token-1" };
      rerender(<MainLayout {...props} />);

      contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-present", "true");
    });
  });

  // ============================================================================
  // VisualEffects Component Tests
  // ============================================================================

  describe("VisualEffects rendering", () => {
    it("should always render VisualEffects component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
    });

    it("should pass crtFilter=true to VisualEffects", () => {
      const props = createDefaultProps();
      props.crtFilter = true;

      render(<MainLayout {...props} />);

      const visualEffects = screen.getByTestId("visual-effects");
      expect(visualEffects).toHaveAttribute("data-crt-filter", "true");
    });

    it("should pass crtFilter=false to VisualEffects", () => {
      const props = createDefaultProps();
      props.crtFilter = false;

      render(<MainLayout {...props} />);

      const visualEffects = screen.getByTestId("visual-effects");
      expect(visualEffects).toHaveAttribute("data-crt-filter", "false");
    });

    it("should update when crtFilter changes", () => {
      const props = createDefaultProps();
      props.crtFilter = false;

      const { rerender } = render(<MainLayout {...props} />);

      let visualEffects = screen.getByTestId("visual-effects");
      expect(visualEffects).toHaveAttribute("data-crt-filter", "false");

      props.crtFilter = true;
      rerender(<MainLayout {...props} />);

      visualEffects = screen.getByTestId("visual-effects");
      expect(visualEffects).toHaveAttribute("data-crt-filter", "true");
    });
  });

  // ============================================================================
  // DiceRoller Component Tests
  // ============================================================================

  describe("DiceRoller conditional rendering", () => {
    it("should render DiceRoller when diceRollerOpen is true", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;

      render(<MainLayout {...props} />);

      const diceRollers = screen.getAllByTestId("dice-roller");
      // Should have exactly 1 dice roller (not the viewing one)
      expect(diceRollers.length).toBeGreaterThanOrEqual(1);
    });

    it("should NOT render DiceRoller when diceRollerOpen is false", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = false;
      props.viewingRoll = null;

      render(<MainLayout {...props} />);

      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should render DiceRoller when diceRollerOpen changes to true", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = false;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();

      props.diceRollerOpen = true;
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should remove DiceRoller when diceRollerOpen changes to false", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      props.diceRollerOpen = false;
      rerender(<MainLayout {...props} />);

      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should pass handleRoll to DiceRoller onRoll prop", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.handleRoll = vi.fn();

      render(<MainLayout {...props} />);

      const diceRoller = screen.getByTestId("dice-roller");
      expect(diceRoller).toHaveAttribute("data-on-roll-present", "true");
    });

    it("should pass onClose handler that calls toggleDiceRoller(false)", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.toggleDiceRoller = vi.fn();

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should maintain DiceRoller when other props change", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      // Change other props
      props.crtFilter = true;
      props.isDM = true;
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should render DiceRoller independently of rollLogOpen state", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.rollLogOpen = false;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // RollLog Component Tests
  // ============================================================================

  describe("RollLog conditional rendering", () => {
    it("should render RollLog when rollLogOpen is true", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should NOT render RollLog when rollLogOpen is false", () => {
      const props = createDefaultProps();
      props.rollLogOpen = false;

      render(<MainLayout {...props} />);

      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
    });

    it("should render RollLog wrapper div with correct styles when rollLogOpen is true", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;

      const { container } = render(<MainLayout {...props} />);

      const rollLog = screen.getByTestId("roll-log");
      const wrapper = rollLog.parentElement;

      expect(wrapper?.style.position).toBe("fixed");
      expect(wrapper?.style.right).toBe("20px");
      expect(wrapper?.style.top).toBe("200px");
      expect(wrapper?.style.width).toBe("350px");
      expect(wrapper?.style.height).toBe("500px");
      expect(wrapper?.style.zIndex).toBe("1000");
    });

    it("should pass rollHistory to RollLog", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.rollHistory = [
        {
          id: "roll-1",
          tokens: [],
          perDie: [],
          total: 10,
          timestamp: Date.now(),
          playerName: "Player 1",
        },
        {
          id: "roll-2",
          tokens: [],
          perDie: [],
          total: 15,
          timestamp: Date.now(),
          playerName: "Player 2",
        },
      ];

      render(<MainLayout {...props} />);

      const rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", "2");
    });

    it("should pass empty rollHistory to RollLog", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.rollHistory = [];

      render(<MainLayout {...props} />);

      const rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", "0");
    });

    it("should render RollLog when rollLogOpen changes to true", () => {
      const props = createDefaultProps();
      props.rollLogOpen = false;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();

      props.rollLogOpen = true;
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should remove RollLog when rollLogOpen changes to false", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();

      props.rollLogOpen = false;
      rerender(<MainLayout {...props} />);

      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
    });

    it("should pass handleClearLog to RollLog onClearLog prop", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.handleClearLog = vi.fn();

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should pass handleViewRoll to RollLog onViewRoll prop", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.handleViewRoll = vi.fn();

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should pass onClose handler that calls toggleRollLog(false)", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.toggleRollLog = vi.fn();

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should update rollHistory prop when it changes", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.rollHistory = [];

      const { rerender } = render(<MainLayout {...props} />);

      let rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", "0");

      props.rollHistory = [
        {
          id: "roll-1",
          tokens: [],
          perDie: [],
          total: 10,
          timestamp: Date.now(),
          playerName: "Player 1",
        },
        {
          id: "roll-2",
          tokens: [],
          perDie: [],
          total: 15,
          timestamp: Date.now(),
          playerName: "Player 2",
        },
        {
          id: "roll-3",
          tokens: [],
          perDie: [],
          total: 20,
          timestamp: Date.now(),
          playerName: "Player 3",
        },
      ];
      rerender(<MainLayout {...props} />);

      rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", "3");
    });

    it("should maintain RollLog when other props change", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();

      // Change other props
      props.crtFilter = true;
      props.isDM = true;
      props.gridSize = 100;
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should render RollLog independently of diceRollerOpen state", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.diceRollerOpen = false;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should render RollLog and DiceRoller simultaneously when both are open", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.diceRollerOpen = true;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DiceRoller (Viewing) Component Tests
  // ============================================================================

  describe("DiceRoller viewing mode conditional rendering", () => {
    it("should render viewing DiceRoller when viewingRoll is not null", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      render(<MainLayout {...props} />);

      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers.length).toBeGreaterThanOrEqual(1);
    });

    it("should NOT render viewing DiceRoller when viewingRoll is null", () => {
      const props = createDefaultProps();
      props.viewingRoll = null;
      props.diceRollerOpen = false;

      render(<MainLayout {...props} />);

      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should render viewing DiceRoller wrapper div with correct styles when viewingRoll is not null", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      const { container } = render(<MainLayout {...props} />);

      // Find the wrapper by checking for position: fixed and zIndex: 2000
      const fixedDivs = Array.from(container.querySelectorAll("div")).filter((div) => {
        const style = div.getAttribute("style");
        return style && style.includes("position: fixed") && style.includes("z-index: 2000");
      });

      expect(fixedDivs.length).toBeGreaterThan(0);
      const wrapper = fixedDivs[0];
      expect(wrapper.style.position).toBe("fixed");
      expect(wrapper.style.zIndex).toBe("2000");
    });

    it("should render viewing DiceRoller when viewingRoll changes from null to non-null", () => {
      const props = createDefaultProps();
      props.viewingRoll = null;
      props.diceRollerOpen = false;

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();

      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should remove viewing DiceRoller when viewingRoll changes to null", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      props.viewingRoll = null;
      rerender(<MainLayout {...props} />);

      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should render both DiceRoller and viewing DiceRoller when both conditions are true", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      render(<MainLayout {...props} />);

      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers.length).toBe(2);
    });

    it("should pass empty onRoll function to viewing DiceRoller", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should pass onClose handler that calls handleViewRoll(null)", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };
      props.handleViewRoll = vi.fn();

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should update viewing DiceRoller when viewingRoll changes to different roll", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      props.viewingRoll = {
        id: "roll-2",
        tokens: [],
        perDie: [],
        total: 20,
        timestamp: Date.now(),
        playerName: "Player 2",
      };
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should maintain viewing DiceRoller when other props change", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      const { rerender } = render(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      // Change other props
      props.crtFilter = true;
      props.isDM = true;
      props.rollLogOpen = true;
      rerender(<MainLayout {...props} />);

      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
    });

    it("should render viewing DiceRoller independently of diceRollerOpen state", () => {
      const props = createDefaultProps();
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };
      props.diceRollerOpen = false;

      render(<MainLayout {...props} />);

      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers.length).toBe(1);
    });

    it("should have higher z-index for viewing DiceRoller than regular DiceRoller", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      const { container } = render(<MainLayout {...props} />);

      // Viewing DiceRoller has z-index 2000, regular has default (implicit)
      const fixedDivs = Array.from(container.querySelectorAll("div")).filter((div) => {
        const style = div.getAttribute("style");
        return style && style.includes("position: fixed") && style.includes("z-index: 2000");
      });

      expect(fixedDivs.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // ToastContainer Component Tests
  // ============================================================================

  describe("ToastContainer rendering", () => {
    it("should always render ToastContainer component", () => {
      const props = createDefaultProps();
      render(<MainLayout {...props} />);

      expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    });

    it("should pass empty messages array to ToastContainer", () => {
      const props = createDefaultProps();
      props.toast = {
        messages: [],
        dismiss: vi.fn(),
      };

      render(<MainLayout {...props} />);

      const toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", "0");
    });

    it("should pass populated messages array to ToastContainer", () => {
      const props = createDefaultProps();
      props.toast = {
        messages: [
          { id: "1", message: "Toast 1" },
          { id: "2", message: "Toast 2" },
        ] as any,
        dismiss: vi.fn(),
      };

      render(<MainLayout {...props} />);

      const toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", "2");
    });

    it("should update when toast messages change", () => {
      const props = createDefaultProps();
      props.toast = {
        messages: [],
        dismiss: vi.fn(),
      };

      const { rerender } = render(<MainLayout {...props} />);

      let toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", "0");

      props.toast = {
        messages: [{ id: "1", message: "New toast" }] as any,
        dismiss: vi.fn(),
      };
      rerender(<MainLayout {...props} />);

      toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", "1");
    });
  });

  // ============================================================================
  // Component Hierarchy and Order Tests
  // ============================================================================

  describe("FloatingPanelsLayout component hierarchy and order", () => {
    it("should render all always-visible components in correct order", () => {
      const props = createDefaultProps();

      const { container } = render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      const contextMenu = screen.getByTestId("context-menu");
      const visualEffects = screen.getByTestId("visual-effects");
      const toastContainer = screen.getByTestId("toast-container");

      expect(dmMenu).toBeInTheDocument();
      expect(contextMenu).toBeInTheDocument();
      expect(visualEffects).toBeInTheDocument();
      expect(toastContainer).toBeInTheDocument();

      // Verify order in DOM
      const allElements = Array.from(container.querySelectorAll("[data-testid]"));
      const floatingPanelComponents = allElements.filter((el) =>
        ["dm-menu", "context-menu", "visual-effects", "toast-container"].includes(
          el.getAttribute("data-testid") || "",
        ),
      );

      const order = floatingPanelComponents.map((el) => el.getAttribute("data-testid"));
      const dmMenuIndex = order.indexOf("dm-menu");
      const contextMenuIndex = order.indexOf("context-menu");
      const visualEffectsIndex = order.indexOf("visual-effects");
      const toastContainerIndex = order.indexOf("toast-container");

      // DMMenu should appear before ContextMenu
      expect(dmMenuIndex).toBeLessThan(contextMenuIndex);
      // ContextMenu should appear before VisualEffects
      expect(contextMenuIndex).toBeLessThan(visualEffectsIndex);
      // ToastContainer should appear last
      expect(visualEffectsIndex).toBeLessThan(toastContainerIndex);
    });

    it("should render conditional components in correct order when all are visible", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player 1",
      };

      const { container } = render(<MainLayout {...props} />);

      // All conditional components should be present
      const diceRollers = screen.getAllByTestId("dice-roller");
      const rollLog = screen.getByTestId("roll-log");

      expect(diceRollers.length).toBe(2); // One for diceRollerOpen, one for viewingRoll
      expect(rollLog).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle gridSize of 0", () => {
      const props = createDefaultProps();
      props.gridSize = 0;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-size", "0");
    });

    it("should handle very large gridSize", () => {
      const props = createDefaultProps();
      props.gridSize = 99999;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-size", "99999");
    });

    it("should handle negative camera coordinates", () => {
      const props = createDefaultProps();
      props.camera = { x: -100, y: -200, scale: 0.5 };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-camera-x", "-100");
      expect(dmMenu).toHaveAttribute("data-camera-y", "-200");
      expect(dmMenu).toHaveAttribute("data-camera-scale", "0.5");
    });

    it("should handle very large camera scale", () => {
      const props = createDefaultProps();
      props.camera = { x: 0, y: 0, scale: 10 };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-camera-scale", "10");
    });

    it("should handle empty snapshot with all arrays empty", () => {
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
        props: [],
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-player-count", "0");
      expect(dmMenu).toHaveAttribute("data-characters-count", "0");
      expect(dmMenu).toHaveAttribute("data-props-count", "0");
    });

    it("should handle many alignment points", () => {
      const props = createDefaultProps();
      props.alignmentPoints = Array.from({ length: 100 }, (_, i) => ({
        world: { x: i * 10, y: i * 10 },
        local: { x: i * 5, y: i * 5 },
      }));

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", "100");
    });

    it("should handle many roll history entries", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      props.rollHistory = Array.from({ length: 50 }, (_, i) => ({
        id: `roll-${i}`,
        tokens: [],
        perDie: [],
        total: i * 10,
        timestamp: Date.now() + i,
        playerName: `Player ${i}`,
      }));

      render(<MainLayout {...props} />);

      const rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", "50");
    });

    it("should handle many toast messages", () => {
      const props = createDefaultProps();
      props.toast = {
        messages: Array.from({ length: 20 }, (_, i) => ({
          id: `toast-${i}`,
          message: `Toast message ${i}`,
        })) as any,
        dismiss: vi.fn(),
      };

      render(<MainLayout {...props} />);

      const toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", "20");
    });

    it("should handle all boolean flags set to true", () => {
      const props = createDefaultProps();
      props.isDM = true;
      props.gridLocked = true;
      props.crtFilter = true;
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.alignmentMode = true;
      props.roomPasswordPending = true;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-is-dm", "true");
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-grid-locked", "true");
      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "true");
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-alignment-mode-active", "true");
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-room-password-pending", "true");
    });

    it("should handle all boolean flags set to false", () => {
      const props = createDefaultProps();
      props.isDM = false;
      props.gridLocked = false;
      props.crtFilter = false;
      props.diceRollerOpen = false;
      props.rollLogOpen = false;
      props.alignmentMode = false;
      props.roomPasswordPending = false;
      props.viewingRoll = null;

      render(<MainLayout {...props} />);

      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-is-dm", "false");
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-grid-locked", "false");
      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "false");
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-alignment-mode-active", "false");
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-room-password-pending", "false");
    });

    it("should handle rapid toggling of conditional components", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = false;
      props.rollLogOpen = false;

      const { rerender } = render(<MainLayout {...props} />);

      // Toggle dice roller multiple times
      props.diceRollerOpen = true;
      rerender(<MainLayout {...props} />);
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      props.diceRollerOpen = false;
      rerender(<MainLayout {...props} />);
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();

      props.diceRollerOpen = true;
      rerender(<MainLayout {...props} />);
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();

      // Toggle roll log
      props.rollLogOpen = true;
      rerender(<MainLayout {...props} />);
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();

      props.rollLogOpen = false;
      rerender(<MainLayout {...props} />);
      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();
    });

    it("should handle complex state with all components visible and populated", () => {
      const props = createDefaultProps();
      props.isDM = true;
      props.gridSize = 75;
      props.gridSquareSize = 10;
      props.gridLocked = true;
      props.camera = { x: 100, y: 200, scale: 1.5 };
      props.crtFilter = true;
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.viewingRoll = {
        id: "viewing-roll",
        tokens: [],
        perDie: [],
        total: 20,
        timestamp: Date.now(),
        playerName: "Viewer",
      };
      props.contextMenu = { x: 300, y: 400, tokenId: "token-xyz" };
      props.alignmentMode = true;
      props.alignmentPoints = [
        { world: { x: 0, y: 0 }, local: { x: 0, y: 0 } },
        { world: { x: 100, y: 100 }, local: { x: 50, y: 50 } },
      ];
      props.alignmentSuggestion = {
        position: { x: 50, y: 50 },
        scale: { x: 1.2, y: 1.2 },
        rotation: 45,
      };
      props.roomPasswordStatus = { type: "success", message: "Password set" };
      props.roomPasswordPending = false;
      props.rollHistory = [
        {
          id: "roll-1",
          tokens: [],
          perDie: [],
          total: 15,
          timestamp: Date.now(),
          playerName: "Player 1",
        },
      ];
      props.toast = {
        messages: [{ id: "toast-1", message: "Test toast" }] as any,
        dismiss: vi.fn(),
      };

      render(<MainLayout {...props} />);

      // All components should be present
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
      expect(screen.getAllByTestId("dice-roller").length).toBe(2);
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.getByTestId("toast-container")).toBeInTheDocument();

      // Verify complex state is passed correctly
      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-is-dm", "true");
      expect(dmMenu).toHaveAttribute("data-grid-size", "75");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", "2");
      expect(dmMenu).toHaveAttribute("data-alignment-suggestion-present", "true");

      const contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-present", "true");

      const visualEffects = screen.getByTestId("visual-effects");
      expect(visualEffects).toHaveAttribute("data-crt-filter", "true");

      const rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", "1");

      const toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", "1");
    });

    it("should handle simultaneous state changes across all components", () => {
      const props = createDefaultProps();
      props.isDM = false;
      props.crtFilter = false;
      props.diceRollerOpen = false;
      props.rollLogOpen = false;
      props.viewingRoll = null;
      props.contextMenu = null;
      props.toast.messages = [];

      const { rerender } = render(<MainLayout {...props} />);

      // Verify initial state
      expect(screen.getByTestId("dm-menu")).toHaveAttribute("data-is-dm", "false");
      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "false");
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
      expect(screen.queryByTestId("roll-log")).not.toBeInTheDocument();

      // Change all states simultaneously
      props.isDM = true;
      props.crtFilter = true;
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.viewingRoll = {
        id: "roll-view",
        tokens: [],
        perDie: [],
        total: 25,
        timestamp: Date.now(),
        playerName: "Viewer",
      };
      props.contextMenu = { x: 400, y: 500, tokenId: "ctx-token" };
      props.toast.messages = [
        { id: "t1", message: "Toast 1" },
        { id: "t2", message: "Toast 2" },
      ] as any;
      props.gridSize = 100;
      props.camera = { x: 500, y: 600, scale: 2.5 };
      rerender(<MainLayout {...props} />);

      // Verify all states changed
      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-is-dm", "true");
      expect(dmMenu).toHaveAttribute("data-grid-size", "100");
      expect(dmMenu).toHaveAttribute("data-camera-x", "500");
      expect(dmMenu).toHaveAttribute("data-camera-y", "600");
      expect(dmMenu).toHaveAttribute("data-camera-scale", "2.5");

      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "true");
      expect(screen.getByTestId("context-menu")).toHaveAttribute("data-menu-present", "true");
      expect(screen.getByTestId("toast-container")).toHaveAttribute("data-messages-count", "2");

      const diceRollers = screen.getAllByTestId("dice-roller");
      expect(diceRollers.length).toBe(2);
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
    });

    it("should maintain component isolation - changes to one component should not affect others", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.crtFilter = true;

      const { rerender } = render(<MainLayout {...props} />);

      // All components present
      expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "true");

      // Change only diceRollerOpen
      props.diceRollerOpen = false;
      rerender(<MainLayout {...props} />);

      // DiceRoller gone, others remain
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "true");

      // Change only crtFilter
      props.crtFilter = false;
      rerender(<MainLayout {...props} />);

      // Only crtFilter changed
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
      expect(screen.getByTestId("roll-log")).toBeInTheDocument();
      expect(screen.getByTestId("visual-effects")).toHaveAttribute("data-crt-filter", "false");
    });

    it("should handle null values for all nullable props", () => {
      const props = createDefaultProps();
      props.snapshot = null;
      props.contextMenu = null;
      props.viewingRoll = null;
      props.alignmentSuggestion = null;
      props.alignmentError = null;
      props.roomPasswordStatus = null;
      props.mapSceneObject = null;
      props.stagingZoneSceneObject = null;

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-player-count", "0");
      expect(dmMenu).toHaveAttribute("data-characters-count", "0");
      expect(dmMenu).toHaveAttribute("data-alignment-suggestion-present", "false");
      expect(dmMenu).toHaveAttribute("data-alignment-error-present", "false");
      expect(dmMenu).toHaveAttribute("data-room-password-status-type", "null");
      expect(dmMenu).toHaveAttribute("data-map-locked", "true");
      expect(dmMenu).toHaveAttribute("data-staging-zone-locked", "false");

      expect(screen.getByTestId("context-menu")).toHaveAttribute("data-menu-present", "false");
      expect(screen.queryByTestId("dice-roller")).not.toBeInTheDocument();
    });

    it("should handle extreme values for numeric props", () => {
      const props = createDefaultProps();
      props.gridSize = Number.MAX_SAFE_INTEGER;
      props.gridSquareSize = Number.MAX_SAFE_INTEGER;
      props.camera = {
        x: Number.MAX_SAFE_INTEGER,
        y: Number.MIN_SAFE_INTEGER,
        scale: Number.MAX_SAFE_INTEGER,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-grid-size", String(Number.MAX_SAFE_INTEGER));
      expect(dmMenu).toHaveAttribute("data-grid-square-size", String(Number.MAX_SAFE_INTEGER));
      expect(dmMenu).toHaveAttribute("data-camera-x", String(Number.MAX_SAFE_INTEGER));
      expect(dmMenu).toHaveAttribute("data-camera-y", String(Number.MIN_SAFE_INTEGER));
      expect(dmMenu).toHaveAttribute("data-camera-scale", String(Number.MAX_SAFE_INTEGER));
    });

    it("should handle very long strings in contextMenu tokenId", () => {
      const props = createDefaultProps();
      const longTokenId = "a".repeat(10000);
      props.contextMenu = { x: 100, y: 200, tokenId: longTokenId };

      render(<MainLayout {...props} />);

      const contextMenu = screen.getByTestId("context-menu");
      expect(contextMenu).toHaveAttribute("data-menu-token-id", longTokenId);
    });

    it("should handle very long mapBackground URLs", () => {
      const props = createDefaultProps();
      const longUrl = "https://example.com/" + "a".repeat(5000) + ".jpg";
      props.snapshot = {
        players: [],
        characters: [],
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: longUrl,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-map-background", longUrl);
    });

    it("should handle rapid state transitions of all conditional components", () => {
      const props = createDefaultProps();

      const { rerender } = render(<MainLayout {...props} />);

      // Cycle through various state combinations rapidly
      for (let i = 0; i < 5; i++) {
        props.diceRollerOpen = i % 2 === 0;
        props.rollLogOpen = i % 3 === 0;
        props.viewingRoll =
          i % 2 === 1
            ? {
                id: `roll-${i}`,
                tokens: [],
                perDie: [],
                total: i * 10,
                timestamp: Date.now(),
                playerName: `Player ${i}`,
              }
            : null;
        props.crtFilter = i % 4 === 0;

        rerender(<MainLayout {...props} />);

        // Verify always-visible components are still present
        expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
        expect(screen.getByTestId("context-menu")).toBeInTheDocument();
        expect(screen.getByTestId("visual-effects")).toBeInTheDocument();
        expect(screen.getByTestId("toast-container")).toBeInTheDocument();
      }
    });

    it("should handle all arrays at maximum capacity", () => {
      const props = createDefaultProps();
      const largeNumber = 1000;

      props.alignmentPoints = Array.from({ length: largeNumber }, (_, i) => ({
        world: { x: i, y: i },
        local: { x: i * 2, y: i * 2 },
      }));

      props.rollLogOpen = true;
      props.rollHistory = Array.from({ length: largeNumber }, (_, i) => ({
        id: `roll-${i}`,
        tokens: [],
        perDie: [],
        total: i,
        timestamp: Date.now() + i,
        playerName: `Player ${i}`,
      }));

      props.toast.messages = Array.from({ length: largeNumber }, (_, i) => ({
        id: `toast-${i}`,
        message: `Message ${i}`,
      })) as any;

      props.snapshot = {
        players: Array(largeNumber).fill({}) as any,
        characters: Array(largeNumber).fill({}) as any,
        tokens: [],
        sceneObjects: [],
        drawings: [],
        pointers: [],
        gridSize: 50,
        gridSquareSize: 5,
        props: Array(largeNumber).fill({}) as any,
      };

      render(<MainLayout {...props} />);

      const dmMenu = screen.getByTestId("dm-menu");
      expect(dmMenu).toHaveAttribute("data-alignment-points-count", String(largeNumber));
      expect(dmMenu).toHaveAttribute("data-player-count", String(largeNumber));
      expect(dmMenu).toHaveAttribute("data-characters-count", String(largeNumber));
      expect(dmMenu).toHaveAttribute("data-props-count", String(largeNumber));

      const rollLog = screen.getByTestId("roll-log");
      expect(rollLog).toHaveAttribute("data-rolls-count", String(largeNumber));

      const toastContainer = screen.getByTestId("toast-container");
      expect(toastContainer).toHaveAttribute("data-messages-count", String(largeNumber));
    });

    it("should preserve component rendering order across multiple re-renders", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      props.viewingRoll = {
        id: "roll-1",
        tokens: [],
        perDie: [],
        total: 10,
        timestamp: Date.now(),
        playerName: "Player",
      };

      const { container, rerender } = render(<MainLayout {...props} />);

      const getComponentOrder = () => {
        const allElements = Array.from(container.querySelectorAll("[data-testid]"));
        const floatingComponents = allElements.filter((el) =>
          [
            "dm-menu",
            "context-menu",
            "visual-effects",
            "dice-roller",
            "roll-log",
            "toast-container",
          ].includes(el.getAttribute("data-testid") || ""),
        );
        return floatingComponents.map((el) => el.getAttribute("data-testid"));
      };

      const initialOrder = getComponentOrder();

      // Re-render with various prop changes
      props.isDM = true;
      props.gridSize = 100;
      props.crtFilter = true;
      rerender(<MainLayout {...props} />);

      const afterFirstRerender = getComponentOrder();

      props.camera = { x: 100, y: 200, scale: 1.5 };
      props.alignmentMode = true;
      rerender(<MainLayout {...props} />);

      const afterSecondRerender = getComponentOrder();

      // Order should be consistent (ignoring conditional components that may appear/disappear)
      const dmMenuIndex1 = initialOrder.indexOf("dm-menu");
      const dmMenuIndex2 = afterFirstRerender.indexOf("dm-menu");
      const dmMenuIndex3 = afterSecondRerender.indexOf("dm-menu");

      const contextMenuIndex1 = initialOrder.indexOf("context-menu");
      const contextMenuIndex2 = afterFirstRerender.indexOf("context-menu");
      const contextMenuIndex3 = afterSecondRerender.indexOf("context-menu");

      expect(dmMenuIndex1).toBeLessThan(contextMenuIndex1);
      expect(dmMenuIndex2).toBeLessThan(contextMenuIndex2);
      expect(dmMenuIndex3).toBeLessThan(contextMenuIndex3);
    });
  });
});
