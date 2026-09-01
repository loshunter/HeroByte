import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MobileLayout } from "../MobileLayout";
import { HELP_TOPICS } from "../../features/help/helpTopics";
import type { MainLayoutProps } from "../props/MainLayoutProps";
type DrawingToolbarProps = MainLayoutProps["drawingToolbarProps"];
type DrawingProps = MainLayoutProps["drawingProps"];
type PlayerActions = MainLayoutProps["playerActions"];

// Mock child components. MapBoard's mock RECORDS its props: the mobile shell's
// only job for map-edit is forwarding, so what it forwards is the behaviour.
const mapBoardProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
vi.mock("../../ui/MapBoard", () => ({
  default: (props: Record<string, unknown>) => {
    mapBoardProps.current = props;
    return <div data-testid="map-board">MapBoard</div>;
  },
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

// The mobile shell renders the log's CONTENT inside a MobileScreen since M4a;
// the RollLog window is desktop-only and never mounts here.
vi.mock("../../components/dice/RollLogContent", () => ({
  RollLogContent: () => <div data-testid="roll-log">RollLogContent</div>,
}));

// The DM menu is lazy on mobile exactly as on desktop; the shell test mocks
// the chunk and asserts the shell's half of the contract — that the container
// mounts inside the dm screen, bare (presentation="content").
vi.mock("../../features/dm/lazy-entry", () => ({
  DMMenuContainer: ({ presentation }: { presentation?: string }) => (
    <div data-testid="dm-menu-content" data-presentation={presentation}>
      DMMenuContainer
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
    mapEditRoomWallFamily: "none" as const,
    mapEditSelectedAssetId: "objects:crate",
    mapEditHallwayWidth: 2,
    mapEditSelectedElementId: null,
    mapEditWallsOverlayPinned: false,
    onMapEditRoomRejected: vi.fn(),
    onMapEditGestureDropped: vi.fn(),
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
      roomWallFamily: "none" as const,
      onSelectRoomWallFamily: vi.fn(),
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
      stampMode: false,
      onToggleStampMode: vi.fn(),
      stampRotation: 0,
      onRotateStamp: vi.fn(),
      onToggleAssetPicker: vi.fn(),
      hallwayWidth: 2,
      onSelectHallwayWidth: vi.fn(),
      splineKind: "rope" as const,
      onSelectSplineKind: vi.fn(),
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
      generateHint: null,
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
    chatMessages: [],
    handleSendChat: vi.fn(),
    viewingRoll: null,
    handleRoll: vi.fn(),
    handleEnterRoll: vi.fn(),
    canEnterOver: vi.fn(() => true),
    latestOwnRoll: null,
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

  describe("map-edit forwarding", () => {
    // The gap M4c closed was plumbing: every one of these was already computed
    // on a mobile render and dropped on the floor. Nothing downstream can tell
    // "never wired" from "wired and inert", so the forwarding IS the feature.
    const MAP_EDIT_PROPS = [
      "mapEditMode",
      "mapEditActiveSubTool",
      "mapEditFloorFamily",
      "mapEditRoomWallFamily",
      "mapEditSelectedAssetId",
      "mapEditPlacementDials",
      "mapEditHallwayWidth",
      "mapEditSplineKind",
      "mapEditPopulateGhosts",
      "mapEditWheelActions",
      "mapEditSelectedElementId",
      "mapEditController",
      "mapEditWallsOverlayPinned",
      "onMapEditRoomRejected",
      "onMapEditGestureDropped",
      "onMapEditRegionPlaced",
      "onMapEditRegionDragged",
      "onMapEditSelectElement",
      "onMapEditSampleAsset",
      // Not from the bag — MobileLayout's own counter, because the dock and
      // the canvas are siblings and a finger has no Escape key.
      "mapEditCancelSignal",
    ];

    it("forwards the COMPLETE map-edit surface — a dropped line is a missing key", async () => {
      // The M4b lesson, applied here: every one of these is OPTIONAL on
      // MapBoard, so deleting a forward passes tsc, every unit suite and the
      // full e2e while silently disarming a tool. Pinning the key set is what
      // makes a drop red.
      render(<MobileLayout {...createDefaultProps()} />);
      await screen.findByTestId("map-board");

      const received = Object.keys(mapBoardProps.current!).filter((key) =>
        /^(mapEdit|onMapEdit)/.test(key),
      );
      expect(received.sort()).toEqual([...MAP_EDIT_PROPS].sort());
    });

    it("forwards them by IDENTITY, and the controller un-gated on isDM", async () => {
      const props = createDefaultProps();
      props.isDM = false;
      props.mapEditMode = true;
      props.mapEditActiveSubTool = "room";
      props.mapStudio = {
        marker: "the-one-controller",
      } as unknown as MainLayoutProps["mapStudio"];
      render(<MobileLayout {...props} />);
      await screen.findByTestId("map-board");
      const received = mapBoardProps.current!;

      // Desktop passes the controller at CenterCanvasLayout with no isDM gate
      // because the SERVER gates the commands. Two authorization stories is
      // how a client-only gate ends up mistaken for a real one.
      expect(received.mapEditController).toBe(props.mapStudio);
      expect(received.mapEditMode).toBe(true);
      expect(received.mapEditActiveSubTool).toBe("room");
      expect(received.onMapEditRegionPlaced).toBe(props.onMapEditRegionPlaced);
      expect(received.onMapEditRoomRejected).toBe(props.onMapEditRoomRejected);
      // The phone is the surface this one exists for: a DM authoring over a
      // real network drops gestures the desktop never notices.
      expect(received.onMapEditGestureDropped).toBe(props.onMapEditGestureDropped);
      expect(received.onMapEditSelectElement).toBe(props.onMapEditSelectElement);
      expect(received.onMapEditSampleAsset).toBe(props.onMapEditSampleAsset);
      expect(received.onMapEditRegionDragged).toBe(props.onMapEditRegionDragged);
    });

    it("does NOT forward mapEditToolbarProps — that feeds the palette, not the canvas", async () => {
      render(<MobileLayout {...createDefaultProps()} />);
      await screen.findByTestId("map-board");
      expect(mapBoardProps.current).not.toHaveProperty("mapEditToolbarProps");
    });
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

  describe("the surface machine (M4a)", () => {
    // Every open surface root carries data-mobile-surface, so the invariant
    // the machine claims — at most one surface, by construction — is counted
    // in the DOM rather than trusted.
    const openSurfaces = () =>
      [...document.querySelectorAll("[data-mobile-surface]")].map((el) =>
        el.getAttribute("data-mobile-surface"),
      );

    const dock = (name: RegExp) =>
      within(screen.getByRole("navigation", { name: /mobile actions/i })).getByRole("button", {
        name,
      });

    const openHelp = () => {
      fireEvent.click(dock(/tools/i));
      fireEvent.click(screen.getByRole("button", { name: /^help$/i }));
      expect(screen.getByRole("dialog", { name: /herobyte help/i })).toBeInTheDocument();
    };

    it("mounts at most one surface, in whatever order things open", () => {
      render(<MobileLayout {...createDefaultProps()} />);
      expect(openSurfaces()).toEqual([]);

      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual(["party"]);

      fireEvent.click(dock(/tools/i));
      expect(openSurfaces()).toEqual(["tools"]);

      fireEvent.click(screen.getByRole("button", { name: /^help$/i }));
      expect(openSurfaces()).toEqual(["help"]);

      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual(["party"]);

      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual([]);
    });

    it("the dice overlay registers in the surface count like every other surface", () => {
      // The review found dice was the one surface whose data-mobile-surface
      // attribute nothing asserted — so deleting it would silently blind the
      // counting instrument to dice, and a dice-stacks-with-X regression
      // would pass both this suite and the e2e surfaces check.
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      render(<MobileLayout {...props} />);

      expect(openSurfaces()).toEqual(["dice"]);
    });

    it("the World tile MOUNTS the atlas surface for a player (A6) — the machine test alone cannot see a missing mount", () => {
      render(<MobileLayout {...createDefaultProps()} />);
      fireEvent.click(dock(/tools/i));
      fireEvent.click(screen.getByRole("button", { name: /^world$/i }));
      expect(openSurfaces()).toEqual(["atlas"]);
      expect(screen.getByRole("dialog", { name: /world map/i })).toBeInTheDocument();
      // Nothing discovered in the default props: the friendly empty state.
      expect(screen.getByText(/The map is blank/)).toBeInTheDocument();
    });

    it("arming the link aim clears whatever surface is up — capturing needs the MAP (A6)", () => {
      const props = createDefaultProps();
      const { rerender } = render(<MobileLayout {...props} />);
      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual(["party"]);

      rerender(<MobileLayout {...{ ...props, linkAimActive: true }} />);
      expect(openSurfaces()).toEqual([]);
    });

    it("the DM's tool sheet offers no World tile — the Atlas tab is theirs", () => {
      const props = createDefaultProps();
      props.isDM = true;
      render(<MobileLayout {...props} />);
      fireEvent.click(dock(/tools/i));
      expect(screen.queryByRole("button", { name: /^world$/i })).toBeNull();
    });

    it("derives one surface even when the prop-controlled panels disagree", () => {
      const props = createDefaultProps();
      props.diceRollerOpen = true;
      props.rollLogOpen = true;
      render(<MobileLayout {...props} />);

      expect(openSurfaces()).toEqual(["log"]);
    });

    it("hands a prop-controlled panel back to the App before opening its own", () => {
      const props = createDefaultProps();
      props.rollLogOpen = true;
      const { rerender } = render(<MobileLayout {...props} />);
      expect(openSurfaces()).toEqual(["log"]);

      fireEvent.click(dock(/party/i));
      // The machine cannot unmount what the App owns; it asks, and the panel
      // stays until the App answers.
      expect(props.toggleRollLog).toHaveBeenCalledWith(false);
      expect(openSurfaces()).toEqual(["log"]);

      rerender(<MobileLayout {...props} rollLogOpen={false} />);
      expect(openSurfaces()).toEqual(["party"]);
    });

    it.each([
      ["Party", /party/i],
      ["Tools", /tools/i],
      ["Dice", /dice/i],
      ["Log", /log/i],
    ])("closes the manual when %s is tapped on the dock", (_label, pattern) => {
      render(<MobileLayout {...createDefaultProps()} />);
      openHelp();

      fireEvent.click(dock(pattern));

      expect(screen.queryByRole("dialog", { name: /herobyte help/i })).not.toBeInTheDocument();
    });

    it("shows the same manual the desktop popover shows, and closes from its ✕", () => {
      render(<MobileLayout {...createDefaultProps()} />);
      openHelp();

      const dialog = screen.getByRole("dialog", { name: /herobyte help/i });
      for (const topic of HELP_TOPICS) {
        expect(within(dialog).getByRole("button", { name: topic.title })).toBeInTheDocument();
      }

      fireEvent.click(screen.getByRole("button", { name: /close help/i }));
      expect(screen.queryByRole("dialog", { name: /herobyte help/i })).not.toBeInTheDocument();
    });

    it("a DM's slot five opens the DM screen through the same machine", async () => {
      const props = createDefaultProps();
      props.isDM = true;
      render(<MobileLayout {...props} />);

      fireEvent.click(dock(/dm/i));
      expect(openSurfaces()).toEqual(["dm"]);
      expect(screen.getByRole("dialog", { name: "DM Menu" })).toBeInTheDocument();
      // The REAL menu (M4b), lazily — bare content, no desktop dress.
      const menu = await screen.findByTestId("dm-menu-content");
      expect(menu).toHaveAttribute("data-presentation", "content");

      // One machine, so any other surface replaces it rather than stacking.
      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual(["party"]);

      fireEvent.click(dock(/dm/i));
      fireEvent.click(screen.getByRole("button", { name: "Close DM Menu" }));
      expect(openSurfaces()).toEqual([]);
    });

    it("de-elevating with the DM screen open takes the shell down with it", async () => {
      const props = createDefaultProps();
      props.isDM = true;
      const { rerender } = render(<MobileLayout {...props} />);

      fireEvent.click(dock(/dm/i));
      expect(await screen.findByTestId("dm-menu-content")).toBeInTheDocument();

      // The server revokes DM (or EXIT DM MODE lands): the screen must not
      // stay up as an empty shell around a menu that renders null.
      rerender(<MobileLayout {...props} isDM={false} />);
      expect(screen.queryByRole("dialog", { name: "DM Menu" })).not.toBeInTheDocument();
      expect(openSurfaces()).toEqual([]);
    });

    it("Party and Log open as screens with a labelled exit that closes them", () => {
      const props = createDefaultProps();
      render(<MobileLayout {...props} />);

      fireEvent.click(dock(/party/i));
      const party = screen.getByRole("dialog", { name: "Party Members" });
      expect(within(party).getByText(/Party Members/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close Party Members" }));
      expect(screen.queryByRole("dialog", { name: "Party Members" })).not.toBeInTheDocument();

      // The log is prop-controlled: its screen mounts on the prop, and its ✕
      // hands the close back to the App rather than unmounting anything.
      props.rollLogOpen = true;
      const { unmount } = render(<MobileLayout {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "Close Roll Log" }));
      expect(props.toggleRollLog).toHaveBeenCalledWith(false);
      unmount();
    });

    it("the drawing sheet yields the sheet slot to tools AND help", () => {
      const props = createDefaultProps();
      props.activeTool = "draw";
      props.drawMode = true;
      props.drawingToolbarProps = {
        drawTool: "freehand",
        drawColor: "#ff0000",
        drawWidth: 3,
        canUndo: false,
        canRedo: false,
        onToolChange: vi.fn(),
        onColorChange: vi.fn(),
        onWidthChange: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      } as unknown as DrawingToolbarProps;
      render(<MobileLayout {...props} />);
      expect(document.querySelector(".mobile-drawing-sheet")).not.toBeNull();

      fireEvent.click(dock(/tools/i));
      expect(document.querySelector(".mobile-drawing-sheet")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /^help$/i }));
      // The old shell suppressed on showTools only, and the manual relied on a
      // z-index override to out-paint this sheet. Mount exclusion replaces
      // paint order; if this mounts under the manual again, that regressed.
      expect(document.querySelector(".mobile-drawing-sheet")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: /close help/i }));
      expect(document.querySelector(".mobile-drawing-sheet")).not.toBeNull();
    });
  });
});
