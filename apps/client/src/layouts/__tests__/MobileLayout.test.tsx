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

vi.mock("../../components/dice/MobileResultOverlay", () => ({
  MobileResultOverlay: ({ result, onClose }: { result: unknown; onClose: () => void }) =>
    result ? (
      <div data-testid="mobile-result-overlay">
        MobileResultOverlay
        <button onClick={onClose} data-testid="close-result-btn">
          Close
        </button>
      </div>
    ) : null,
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
    mapEditMode: false,
    mapEditActiveSubTool: "wall" as const,
    mapEditFloorFamily: "grass" as const,
    mapEditSelectedAssetId: "objects:crate",
    mapEditHallwayWidth: 2,
    mapEditSelectedElementId: null,
    mapEditWallsOverlayPinned: false,
    onMapEditRoomRejected: vi.fn(),
    onMapEditRegionPlaced: vi.fn(),
    onMapEditRegionDragged: vi.fn(),
    onMapEditSelectElement: vi.fn(),
    onMapEditSampleAsset: vi.fn(),
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
      generateParams: {
        theme: "stone" as const,
        density: "medium" as const,
        seed: 1,
      },
      onGenerateParamsChange: vi.fn(),
      onRerollSeed: vi.fn(),
      onGenerate: vi.fn(),
      canGenerate: false,
      generateRegion: null,
      saving: false,
      layers: [],
      selectedElement: null,
      onUpdateLayer: vi.fn(),
      onMoveLayer: vi.fn(),
      onUpdateElement: vi.fn(),
      onUpdateDoor: vi.fn(),
      onRemoveElement: vi.fn(),
      layersOpen: false,
      onToggleLayers: vi.fn(),
      inspectorOpen: false,
      onToggleInspector: vi.fn(),
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

  it("shows only one mobile sheet at a time (opening one closes the others)", () => {
    render(<MobileLayout {...createDefaultProps()} />);
    const dock = (name: RegExp) => screen.getByRole("button", { name });

    // Open the Party panel.
    fireEvent.click(dock(/party/i));
    expect(screen.getByText(/Party Members/i)).toBeInTheDocument();
    expect(document.querySelector(".mobile-tool-sheet")).toBeNull();

    // Opening Tools closes the Party panel.
    fireEvent.click(dock(/tools/i));
    expect(document.querySelector(".mobile-tool-sheet")).not.toBeNull();
    expect(screen.queryByText(/Party Members/i)).not.toBeInTheDocument();

    // Opening Party again closes the tool sheet.
    fireEvent.click(dock(/party/i));
    expect(screen.getByText(/Party Members/i)).toBeInTheDocument();
    expect(document.querySelector(".mobile-tool-sheet")).toBeNull();
  });

  it("closes the open Party panel when a prop-controlled sheet (dice) opens", () => {
    const props = createDefaultProps();
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /party/i }));
    expect(screen.getByText(/Party Members/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dice/i }));
    expect(props.toggleDiceRoller).toHaveBeenCalledWith(true);
    expect(screen.queryByText(/Party Members/i)).not.toBeInTheDocument();
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

  it("renders MobileResultOverlay when viewingRoll is present", () => {
    const props = createDefaultProps();
    props.viewingRoll = { total: 20, playerName: "Test Player" } as MainLayoutProps["viewingRoll"];
    render(<MobileLayout {...props} />);

    expect(screen.getByTestId("mobile-result-overlay")).toBeInTheDocument();
  });

  it("does not render MobileResultOverlay when viewingRoll is null", () => {
    const props = createDefaultProps();
    render(<MobileLayout {...props} />);

    expect(screen.queryByTestId("mobile-result-overlay")).not.toBeInTheDocument();
  });

  it("closes the viewed roll via handleViewRoll(null)", () => {
    const props = createDefaultProps();
    props.viewingRoll = { total: 20, playerName: "Test Player" } as MainLayoutProps["viewingRoll"];
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByTestId("close-result-btn"));

    expect(props.handleViewRoll).toHaveBeenCalledWith(null);
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
