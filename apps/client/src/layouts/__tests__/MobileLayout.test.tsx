import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileLayout } from "../MobileLayout";
import type { MainLayoutProps } from "../props/MainLayoutProps";
import type { RollResult } from "../../../components/dice/types";
import type { DrawingToolbarProps } from "../../../features/drawing/components/DrawingToolbar";
import type { DrawingProps } from "../../../features/drawing/components/DrawingCanvas";
import type { PlayerActions } from "../../../features/player/usePlayerActions";

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
    handleFocusSelf: vi.fn(),
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
    updateNameInput: vi.fn(),
    startNameEdit: vi.fn(),
    submitNameEdit: vi.fn(),
    updateHpInput: vi.fn(),
    startHpEdit: vi.fn(),
    submitHpEdit: vi.fn(),
    updateMaxHpInput: vi.fn(),
    startMaxHpEdit: vi.fn(),
    submitMaxHpEdit: vi.fn(),
    selectedObjectId: null,
    selectedObjectIds: [],
    handleObjectSelection: vi.fn(),
    handleObjectSelectionBatch: vi.fn(),
    lockSelected: vi.fn(),
    unlockSelected: vi.fn(),
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
    toast: { messages: [], dismiss: vi.fn() },
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

  it("toggles the mobile controls menu", () => {
    render(<MobileLayout {...createDefaultProps()} />);

    // Initially controls are hidden
    expect(screen.queryByText("🎲 Dice")).not.toBeInTheDocument();

    // Click toggle button
    const toggleBtn = screen.getByText("☰");
    fireEvent.click(toggleBtn);

    // Now controls should be visible
    expect(screen.getByText("🎲 Dice")).toBeInTheDocument();
    expect(screen.getByText("📜 Log")).toBeInTheDocument();

    // Click toggle button again
    fireEvent.click(screen.getByText("✕"));

    // Controls should be hidden again
    expect(screen.queryByText("🎲 Dice")).not.toBeInTheDocument();
  });

  it("toggles the dice roller via the menu", () => {
    const props = createDefaultProps();
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByText("☰"));
    fireEvent.click(screen.getByText("🎲 Dice"));

    expect(props.toggleDiceRoller).toHaveBeenCalledWith(true);
  });

  it("toggles the roll log via the menu", () => {
    const props = createDefaultProps();
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByText("☰"));
    fireEvent.click(screen.getByText("📜 Log"));

    expect(props.toggleRollLog).toHaveBeenCalledWith(true);
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
    props.viewingRoll = { total: 20 } as RollResult;
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
