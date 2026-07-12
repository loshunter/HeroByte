import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileLayout } from "../MobileLayout";
import type { MainLayoutProps } from "../props/MainLayoutProps";
type DrawingToolbarProps = MainLayoutProps["drawingToolbarProps"];
type DrawingProps = MainLayoutProps["drawingProps"];
type PlayerActions = MainLayoutProps["playerActions"];

// Mock child components
vi.mock("../../ui/MapBoard", () => ({
  default: () => <div data-testid="map-board">MapBoard</div>,
}));

vi.mock("../../components/ui/MapLoading", () => ({
  MapLoading: () => <div data-testid="map-loading">Loading...</div>,
}));

vi.mock("../../features/initiative/components/TurnNavigationControls", () => ({
  TurnNavigationControls: ({
    onNextTurn,
    onPreviousTurn,
  }: {
    onNextTurn: () => void;
    onPreviousTurn: () => void;
  }) => (
    <div data-testid="turn-controls">
      <button onClick={onPreviousTurn} data-testid="prev-turn-btn">
        Prev
      </button>
      <button onClick={onNextTurn} data-testid="next-turn-btn">
        Next
      </button>
    </div>
  ),
}));

vi.mock("../../components/dice/DiceRoller", () => ({
  DiceRoller: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="dice-roller">
      DiceRoller
      <button onClick={onClose} data-testid="close-dice-btn">
        Close
      </button>
    </div>
  ),
}));

vi.mock("../../components/dice/RollLog", () => ({
  RollLog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="roll-log">
      RollLog
      <button onClick={onClose} data-testid="close-log-btn">
        Close
      </button>
    </div>
  ),
}));

vi.mock("../../components/dice/ResultPanel", () => ({
  ResultPanel: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="result-panel">
      ResultPanel
      <button onClick={onClose} data-testid="close-result-btn">
        Close
      </button>
    </div>
  ),
}));

// MapStudioWorkspace now loads lazily by path (Slice L), so mock the module the
// dynamic import resolves — not the barrel, which no longer re-exports it.
vi.mock("../../features/map-studio/components/MapStudioWorkspace", () => ({
  MapStudioWorkspace: ({ onExit }: { onExit: () => void }) => (
    <div data-testid="map-studio-workspace">
      Map Studio
      <button type="button" onClick={onExit}>
        Exit Studio
      </button>
    </div>
  ),
}));

describe("MobileLayout", () => {
  const createDefaultProps = (): MainLayoutProps => ({
    isConnected: true,
    topHeight: 0,
    bottomHeight: 0,
    topPanelRef: { current: null },
    bottomPanelRef: { current: null },
    contextMenu: null,
    setContextMenu: vi.fn(),
    activeTool: "pointer",
    setActiveTool: vi.fn(),
    drawMode: false,
    pointerMode: true,
    measureMode: false,
    transformMode: false,
    selectMode: false,
    alignmentMode: false,
    mapStudioMode: false,
    openMapStudio: vi.fn(),
    mapEditMode: false,
    mapEditActiveSubTool: "wall" as const,
    mapEditFloorFamily: "grass" as const,
    mapEditSelectedAssetId: "objects:crate",
    mapEditHallwayWidth: 2,
    mapEditWallsOverlayPinned: false,
    onMapEditRoomRejected: vi.fn(),
    onMapEditRegionPlaced: vi.fn(),
    mapEditToolbarProps: {
      isLive: false,
      busy: false,
      activeSubTool: "wall" as const,
      onSelectSubTool: vi.fn(),
      floorFamily: "grass" as const,
      onSelectFloorFamily: vi.fn(),
      canUndo: false,
      canRedo: false,
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onStartLiveMap: vi.fn(),
      onClose: vi.fn(),
      hasRasterBackground: false,
      error: null,
      wallsOverlayPinned: false,
      onToggleWallsOverlay: vi.fn(),
      selectedAssetId: "objects:crate",
      onSelectAsset: vi.fn(),
      uploadAsset: vi.fn(),
      assetPickerOpen: false,
      onToggleAssetPicker: vi.fn(),
      hallwayWidth: 2,
      onSelectHallwayWidth: vi.fn(),
      populateDensity: "medium" as const,
      onSelectPopulateDensity: vi.fn(),
      populateCategory: "objects" as const,
      onSelectPopulateCategory: vi.fn(),
      onPopulate: vi.fn(),
      canPopulate: false,
    },
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
    snapshot: { combatActive: false } as MainLayoutProps["snapshot"],
    uid: "test-uid",
    gridSize: 50,
    gridSquareSize: 5,
    isDM: false,
    cameraState: { x: 0, y: 0, scale: 1 },
    camera: { x: 0, y: 0, scale: 1 },
    cameraCommand: null,
    handleCameraCommandHandled: vi.fn(),
    setCameraState: vi.fn(),
    handleFocusToken: vi.fn(),
    handleResetCamera: vi.fn(),
    drawingToolbarProps: {} as DrawingToolbarProps,
    drawingProps: {} as DrawingProps,
    handleClearDrawings: vi.fn(),
    editingPlayerUID: null,
    nameInput: "",
    editingHpUID: null,
    hpInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    editingTempHpUID: null,
    tempHpInput: "",
    updateNameInput: vi.fn(),
    startNameEdit: vi.fn(),
    submitNameEdit: vi.fn(),
    updateHpInput: vi.fn(),
    startHpEdit: vi.fn(),
    submitHpEdit: vi.fn(),
    updateMaxHpInput: vi.fn(),
    startMaxHpEdit: vi.fn(),
    submitMaxHpEdit: vi.fn(),
    updateTempHpInput: vi.fn(),
    startTempHpEdit: vi.fn(),
    submitTempHpEdit: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    selectedObjectId: null,
    selectedObjectIds: [],
    handleObjectSelection: vi.fn(),
    handleObjectSelectionBatch: vi.fn(),
    lockSelected: vi.fn(),
    unlockSelected: vi.fn(),
    selectPlayerTokens: vi.fn(),
    playerActions: {} as PlayerActions,
    mapSceneObject: null,
    stagingZoneSceneObject: null,
    recolorToken: vi.fn(),
    transformSceneObject: vi.fn(),
    toggleSceneObjectLock: vi.fn(),
    deleteToken: vi.fn(),
    updateTokenImage: vi.fn(),
    updateTokenSize: vi.fn(),
    alignmentPoints: [],
    alignmentSuggestion: null,
    alignmentError: null,
    handleAlignmentStart: vi.fn(),
    handleAlignmentReset: vi.fn(),
    handleAlignmentCancel: vi.fn(),
    handleAlignmentApply: vi.fn(),
    handleAlignmentPointCapture: vi.fn(),
    rollHistory: [],
    viewingRoll: null,
    handleRoll: vi.fn(),
    handleClearLog: vi.fn(),
    handleViewRoll: vi.fn(),
    handleSetRoomPassword: vi.fn(),
    roomPasswordStatus: null,
    roomPasswordPending: false,
    dismissRoomPasswordStatus: vi.fn(),
    handleToggleDM: vi.fn(),
    setMapBackgroundURL: vi.fn(),
    setGridSize: vi.fn(),
    setGridSquareSize: vi.fn(),
    toast: {
      messages: [],
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    },
    sendMessage: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the MapBoard", async () => {
    render(<MobileLayout {...createDefaultProps()} />);
    expect(await screen.findByTestId("map-board")).toBeInTheDocument();
  });

  it("renders turn controls when combat is active", () => {
    const props = createDefaultProps();
    props.snapshot = { combatActive: true } as MainLayoutProps["snapshot"];
    render(<MobileLayout {...props} />);
    expect(screen.getByTestId("turn-controls")).toBeInTheDocument();
  });

  it("does not render turn controls when combat is inactive", () => {
    const props = createDefaultProps();
    props.snapshot = { combatActive: false } as MainLayoutProps["snapshot"];
    render(<MobileLayout {...props} />);
    expect(screen.queryByTestId("turn-controls")).not.toBeInTheDocument();
  });

  it("opens and closes the mobile tool sheet", () => {
    render(<MobileLayout {...createDefaultProps()} />);

    expect(screen.queryByText("Ping")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tools/i }));

    expect(screen.getByText("Ping")).toBeInTheDocument();
    expect(screen.getByText("Measure")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close tools/i }));

    expect(screen.queryByText("Ping")).not.toBeInTheDocument();
  });

  it("toggles the dice roller via the dock", () => {
    const props = createDefaultProps();
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /dice/i }));

    expect(props.toggleDiceRoller).toHaveBeenCalledWith(true);
  });

  it("toggles the roll log via the dock", () => {
    const props = createDefaultProps();
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /log/i }));

    expect(props.toggleRollLog).toHaveBeenCalledWith(true);
  });

  it("selects mobile map tools from the tool sheet", () => {
    const props = createDefaultProps();
    props.activeTool = null;
    props.pointerMode = false;
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /tools/i }));
    fireEvent.click(screen.getByRole("button", { name: /ping/i }));

    expect(props.setActiveTool).toHaveBeenCalledWith("pointer");
  });

  it("renders selected object actions in transform mode", () => {
    const props = createDefaultProps();
    props.activeTool = "transform";
    props.transformMode = true;
    props.isDM = true;
    props.selectedObjectIds = ["token:1"];

    render(<MobileLayout {...props} />);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^lock$/i }));
    expect(props.lockSelected).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(props.handleObjectSelection).toHaveBeenCalledWith(null);
    expect(props.handleObjectSelectionBatch).toHaveBeenCalledWith([]);
  });

  it("renders Map Studio workspace for a DM in mobile map-studio mode", async () => {
    const props = createDefaultProps();
    props.activeTool = "map-studio";
    props.mapStudioMode = true;
    props.isDM = true;
    props.mapStudio = {} as NonNullable<MainLayoutProps["mapStudio"]>;

    render(<MobileLayout {...props} />);

    // The editor is lazy-loaded (Slice L) — it resolves after the Suspense fallback.
    expect(await screen.findByTestId("map-studio-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("map-board")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /exit studio/i }));

    expect(props.setActiveTool).toHaveBeenCalledWith(null);
  });

  it("renders DiceRoller when diceRollerOpen is true", () => {
    const props = createDefaultProps();
    props.diceRollerOpen = true;
    render(<MobileLayout {...props} />);

    expect(screen.getByTestId("dice-roller")).toBeInTheDocument();
  });

  it("renders RollLog when rollLogOpen is true", () => {
    const props = createDefaultProps();
    props.rollLogOpen = true;
    render(<MobileLayout {...props} />);

    expect(screen.getByTestId("roll-log")).toBeInTheDocument();
  });

  it("renders ResultPanel when viewingRoll is present", () => {
    const props = createDefaultProps();
    props.viewingRoll = { total: 20, playerName: "Test Player" } as MainLayoutProps["viewingRoll"];
    render(<MobileLayout {...props} />);

    expect(screen.getByTestId("result-panel")).toBeInTheDocument();
  });

  it("sends next-turn and previous-turn messages", () => {
    const props = createDefaultProps();
    props.snapshot = { combatActive: true } as MainLayoutProps["snapshot"];
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByTestId("next-turn-btn"));
    expect(props.sendMessage).toHaveBeenCalledWith({ t: "next-turn" });

    fireEvent.click(screen.getByTestId("prev-turn-btn"));
    expect(props.sendMessage).toHaveBeenCalledWith({ t: "previous-turn" });
  });
});
