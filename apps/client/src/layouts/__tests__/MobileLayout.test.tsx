import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { HOLD_START_DELAY_MS } from "../MobileMovePad";
import { HOLD_STEP_INTERVAL_MS } from "../../features/movement/useKeyboardMovement";
import { MobileLayout } from "../MobileLayout";
import { KickLayoutUnderTest } from "./kickLayout.fixtures";
import { HELP_TOPICS } from "../../features/help/helpTopics";
import type { MainLayoutProps } from "../props/MainLayoutProps";
import type { KickControls } from "../../features/atlas/useKickedInDoor";
import {
  __resetDMMenuRequestsForTests,
  takeDMMenuTabRequest,
} from "../../features/table/menuRequest";
import { markNewTable } from "../../features/table/newTableMarker";
import { savePlayerState } from "../../utils/playerPersistence";
import { ReconnectPhaseContext } from "../../features/table/reconnectPhase";
import { installMemoryStorage } from "../../test-utils/memoryStorage";
type DrawingToolbarProps = MainLayoutProps["drawingToolbarProps"];
type DrawingProps = MainLayoutProps["drawingProps"];
// Save character reaches the real file writer; here it is a spy, so a test can read what the
// phone's party list was handed to write. The loader stays real.
vi.mock("../../utils/playerPersistence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/playerPersistence")>()),
  savePlayerState: vi.fn(),
}));

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
  DMMenuContainer: ({
    presentation,
    openKick,
    onFocusToken,
  }: {
    presentation?: string;
    openKick?: () => void;
    onFocusToken?: (tokenId: string) => void;
  }) => (
    <div data-testid="dm-menu-content" data-presentation={presentation}>
      DMMenuContainer
      {/* The Atlas tab's 🚪 button, as the bag delivers it (K3). */}
      {openKick && (
        <button type="button" onClick={openKick}>
          🚪 KICK IN A DOOR
        </button>
      )}
      {/* The NPCs tab's 🎯 Focus (U7). */}
      {onFocusToken && (
        <button type="button" onClick={() => onFocusToken("t-goblin")}>
          Focus Goblin
        </button>
      )}
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
    mapEditTerrainBrushSize: 1 as const,
    mapEditSelectedElementId: null,
    mapEditWallsOverlayPinned: false,
    onMapEditRoomRejected: vi.fn(),
    onMapEditGestureDropped: vi.fn(),
    onMapEditRegionPlaced: vi.fn(),
    onMapEditRegionDragged: vi.fn(),
    onMapEditSelectElement: vi.fn(),
    onMapEditSampleAsset: vi.fn(),
    mapEditToolbarProps: {
      mapName: "Fixture map",
      activeGroup: "structures",
      onSelectGroup: vi.fn(),
      populateTarget: null,
      populateHint: "Draw a room or hallway first.",
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
      buildEntry: { kind: "start" as const },
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
      terrainBrushSize: 1 as const,
      onSelectTerrainBrushSize: vi.fn(),
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
      properties: null,
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
    roleKnown: true,
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

  it("mounts a single mobile CRT overlay without a bezel and removes it when disabled", () => {
    const props = { ...createDefaultProps(), crtFilter: true };
    const { container, rerender } = render(<MobileLayout {...props} />);
    expect(container.querySelectorAll(".crt-filter")).toHaveLength(1);
    expect(container.querySelector(".crt-filter")).toHaveClass("crt-filter--mobile");
    expect(container.querySelectorAll(".crt-vignette")).toHaveLength(1);
    expect(container.querySelector(".crt-bezel")).toBeNull();
    // The browser spec checks ::before's computed content; jsdom cannot paint it.
    rerender(<MobileLayout {...props} crtFilter={false} />);
    expect(container.querySelector(".crt-filter")).toBeNull();
    expect(container.querySelector(".crt-vignette")).toBeNull();
  });

  it("wires Display → CRT (now in the Table screen) to the App preference in both directions", () => {
    const props = createDefaultProps();
    const { rerender } = render(<MobileLayout {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /tools/i }));
    // The tool sheet no longer carries a CRT tile: it is a preference, and Table holds it.
    expect(screen.queryByRole("button", { name: "CRT" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Table" }));

    const crt = screen.getByRole("button", { name: "📺 CRT" });
    expect(crt).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(crt);
    expect(props.setCrtFilter).toHaveBeenLastCalledWith(true);

    rerender(<MobileLayout {...props} crtFilter={true} />);
    expect(screen.getByRole("button", { name: "📺 CRT" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "📺 CRT" }));
    expect(props.setCrtFilter).toHaveBeenLastCalledWith(false);
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
      "mapEditTerrainBrushSize",
      "mapEditSplineKind",
      "mapEditPersistentPreview",
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
      // U2's dock cancels through the shared interaction owner. MobileLayout
      // no longer owns a counter to forward; every remaining map prop is pinned.
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

    fireEvent.click(screen.getByRole("button", { name: /chat/i }));

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

  // The phone Party's DM-only token controls ride MobileSurfaces' own wiring;
  // MobileEntitiesList's tests hand them in, so only this sees a dropped line.
  it("a DM deletes another player's token and moves their character from the phone Party", () => {
    const props = {
      ...createDefaultProps(),
      isDM: true,
      snapshot: {
        combatActive: false,
        players: [
          { uid: "test-uid", name: "DM", isDM: true },
          { uid: "p2", name: "Them" },
        ],
        characters: [
          {
            id: "char-2",
            name: "Wolf",
            type: "pc",
            hp: 9,
            maxHp: 9,
            ownedByPlayerUID: "p2",
            tokenId: "their-token",
          },
        ],
        tokens: [{ id: "their-token", owner: "p2", x: 1, y: 1, color: "blue" }],
        sceneObjects: [],
      } as unknown as MainLayoutProps["snapshot"],
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /party/i }));
    const row = screen
      .getAllByTestId("mobile-player-row")
      .find((candidate) => within(candidate).queryByText("Wolf", { exact: true }))!;
    fireEvent.click(within(row).getByRole("button", { name: /EDIT/ }));
    fireEvent.click(screen.getByRole("button", { name: "🗑️ Delete Token (DM)" }));
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "test-uid" } });

    expect(props.deleteToken).toHaveBeenCalledWith("their-token");
    expect(props.sendMessage).toHaveBeenCalledWith({
      t: "set-character-owner",
      characterId: "char-2",
      ownerUid: "test-uid",
    });
    vi.restoreAllMocks();
  });

  it("a player rolls their character's initiative from the phone Party (U8): the shared dialog, one roll", () => {
    const props = {
      ...createDefaultProps(),
      snapshot: {
        combatActive: false,
        players: [
          { uid: "test-uid", name: "Me" },
          { uid: "p2", name: "Them" },
        ],
        characters: [
          {
            id: "char-me",
            name: "Ranger",
            type: "pc",
            hp: 9,
            maxHp: 9,
            ownedByPlayerUID: "test-uid",
          },
          { id: "char-2", name: "Wolf", type: "pc", hp: 9, maxHp: 9, ownedByPlayerUID: "p2" },
        ],
        tokens: [],
        sceneObjects: [],
      } as unknown as MainLayoutProps["snapshot"],
    };
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /party/i }));
    // Another player's character offers no INIT to a player; their own does.
    expect(screen.queryByRole("button", { name: "Set initiative for Wolf" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Ranger" }));
    expect(screen.getByText("Initiative: Ranger")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No fight is running: saving an initiative starts combat, on Ranger's turn.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Roll d20 now" }));

    const rolls = vi
      .mocked(props.sendMessage)
      .mock.calls.filter(([message]) => message.t === "roll-initiative");
    // The dial was not touched: no modifier, so the server rolls with the stored one.
    expect(rolls).toEqual([[{ t: "roll-initiative", characterId: "char-me" }]]);
    expect(screen.queryByText("Initiative: Ranger")).not.toBeInTheDocument();
  });

  it("with a fight running, the phone dialog says nothing about starting one", () => {
    const props = {
      ...createDefaultProps(),
      snapshot: {
        combatActive: true,
        players: [{ uid: "test-uid", name: "Me" }],
        characters: [
          {
            id: "char-me",
            name: "Ranger",
            type: "pc",
            hp: 9,
            maxHp: 9,
            ownedByPlayerUID: "test-uid",
          },
        ],
        tokens: [],
        sceneObjects: [],
      } as unknown as MainLayoutProps["snapshot"],
    };
    render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /party/i }));
    fireEvent.click(screen.getByRole("button", { name: "Set initiative for Ranger" }));
    expect(screen.getByText("Initiative: Ranger")).toBeInTheDocument();
    expect(screen.queryByText(/No fight is running: saving/)).not.toBeInTheDocument();
  });

  it("through a reconnect the phone dialog stays, and closing it gives focus back to the row's INIT", () => {
    // jsdom lays nothing out; focus return needs a control with a box.
    const rect = new DOMRect(0, 0, 44, 44);
    const rects = vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      0: rect,
      length: 1,
      item: (index: number) => (index === 0 ? rect : null),
      [Symbol.iterator]: () => [rect].values(),
    } as unknown as DOMRectList);
    const snapshot = {
      combatActive: true,
      players: [{ uid: "test-uid", name: "Me" }],
      characters: [
        {
          id: "char-me",
          name: "Ranger",
          type: "pc",
          hp: 9,
          maxHp: 9,
          ownedByPlayerUID: "test-uid",
        },
      ],
      tokens: [],
      sceneObjects: [],
    } as unknown as MainLayoutProps["snapshot"];
    const props = { ...createDefaultProps(), snapshot };
    const view = render(<MobileLayout {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /party/i }));
    const opener = screen.getByRole("button", { name: "Set initiative for Ranger" });
    opener.focus();
    fireEvent.click(opener);
    // The socket closes (the snapshot goes null), then the table comes back:
    // the rows are rendered afresh, and the dialog is still the same one.
    view.rerender(<MobileLayout {...props} snapshot={null} />);
    view.rerender(<MobileLayout {...props} snapshot={{ ...snapshot! }} />);
    expect(screen.getByText("Initiative: Ranger")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Initiative: Ranger")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Set initiative for Ranger" }),
    );
    rects.mockRestore();
  });

  it.each([
    [false, false, false],
    [false, true, true],
    [true, false, true],
  ])(
    "the phone Party's INIT: isDM=%s, table allows hand entry=%s → Enter a roll by hand offered=%s",
    (isDM, allowed, offered) => {
      const props = {
        ...createDefaultProps(),
        isDM,
        snapshot: {
          combatActive: true,
          initiativeManualOverride: allowed ? undefined : false,
          // The seat reads not-DM whatever the prop says: the DM case must come
          // from the passed-in flag (the snapshot's lags on reconnect).
          players: [{ uid: "test-uid", name: "Me", isDM: false }],
          characters: [
            {
              id: "char-me",
              name: "Ranger",
              type: "pc",
              hp: 9,
              maxHp: 9,
              ownedByPlayerUID: "test-uid",
            },
          ],
          tokens: [],
          sceneObjects: [],
        } as unknown as MainLayoutProps["snapshot"],
      };
      render(<MobileLayout {...props} />);
      fireEvent.click(screen.getByRole("button", { name: /party/i }));
      fireEvent.click(screen.getByRole("button", { name: "Set initiative for Ranger" }));

      expect(Boolean(screen.queryByRole("button", { name: "Enter a roll by hand" }))).toBe(offered);
      expect(Boolean(screen.queryByText(/Entering a roll by hand is off at this table/))).toBe(
        !offered,
      );
    },
  );

  it("the turn strip names whose turn it is (U8), from the viewer's own snapshot", () => {
    const props = createDefaultProps();
    props.snapshot = {
      combatActive: true,
      currentTurnCharacterId: "char-2",
      characters: [
        { id: "char-1", name: "Ranger", type: "pc", hp: 9, maxHp: 9 },
        { id: "char-2", name: "Wolf", type: "pc", hp: 9, maxHp: 9 },
      ],
    } as unknown as MainLayoutProps["snapshot"];
    const { rerender } = render(<MobileLayout {...props} />);
    expect(screen.getByText("Turn: Wolf")).toBeInTheDocument();
    expect(screen.queryByText("Turn: Ranger")).not.toBeInTheDocument();

    // A turn the server withheld (a hidden NPC's) arrives as no pointer: no name.
    rerender(
      <MobileLayout
        {...props}
        snapshot={{ ...props.snapshot!, currentTurnCharacterId: undefined }}
      />,
    );
    expect(screen.getByText("Turn: —")).toBeInTheDocument();
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

  it("the selection sheet carries the d-pad when the actor may move something; a keyboard activation is one cell", () => {
    // The phone's WASD: threaded App -> MobileLayout -> MobileSelectionSheet ->
    // MobileMovePad. A d-pad that never receives `movement` renders nothing,
    // which is exactly the silent unwire this pins against. `fireEvent.click`
    // carries detail 0 — the Enter/Space road; the finger road is the next case.
    const props = createDefaultProps();
    props.activeTool = "select";
    props.selectMode = true;
    props.selectedObjectIds = ["token:1"];
    const move = vi.fn();
    props.movement = { movableCount: 1, move };

    render(<MobileLayout {...props} />);

    const pad = screen.getByRole("group", { name: /move selection/i });
    fireEvent.click(within(pad).getByRole("button", { name: /^move right$/i }));
    expect(move.mock.calls).toEqual([[{ dx: 1, dy: 0 }]]);
    expect(within(pad).getAllByRole("button")).toHaveLength(8);
  });

  it("the d-pad's camera follow reaches the board as a focus-point, and handled clears it without touching the app's", async () => {
    // jsdom has no layout: the surface and the sheet get real-looking rects
    // (a 375×812 phone, the sheet's top at 472) by class. The token's cell
    // y=9 is world 475 — under the sheet — so mounting the pad over it fires.
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const top = this.classList.contains("mobile-selection-sheet") ? 472 : 0;
        const height = this.classList.contains("mobile-map-surface") ? 812 : 300;
        return { top, left: 0, width: 375, height, bottom: top + height, right: 375 } as DOMRect;
      });
    try {
      const props = createDefaultProps();
      props.activeTool = "select";
      props.selectMode = true;
      props.selectedObjectIds = ["token:1"];
      props.movement = { movableCount: 1, move: vi.fn() };
      // The LIVE camera is threaded, not an identity: at y=100 cell 6 (world
      // 325, plate to 490 on screen) is under the sheet; at the identity it
      // would be 90px clear and nothing would fire.
      props.cameraState = { x: 0, y: 100, scale: 1 };
      props.snapshot = {
        combatActive: false,
        tokens: [{ id: "1", owner: "test-uid", x: 3, y: 6, color: "hsl(0 0% 0%)" }],
        props: [],
        sceneObjects: [],
      } as unknown as MainLayoutProps["snapshot"];
      const { rerender } = render(<MobileLayout {...props} />);
      // MapBoard is lazy: wait for the mock to mount before reading its props.
      await screen.findByTestId("map-board");
      expect(mapBoardProps.current?.cameraCommand).toEqual({
        type: "focus-point",
        x: 175,
        y: 325,
        at: { x: 175, y: 366 },
      });
      act(() => (mapBoardProps.current!.onCameraCommandHandled as () => void)());
      expect(mapBoardProps.current?.cameraCommand).toBeNull();
      expect(props.handleCameraCommandHandled).not.toHaveBeenCalled();
      // With nothing of its own showing, handled goes to the app.
      act(() => (mapBoardProps.current!.onCameraCommandHandled as () => void)());
      expect(props.handleCameraCommandHandled).toHaveBeenCalledTimes(1);
      // A Screen (Party) covers the sheet without unmounting it: the follow
      // is inert behind it — a cell change under an opaque cover moves nothing.
      fireEvent.click(screen.getByRole("button", { name: /party/i }));
      rerender(
        <MobileLayout
          {...props}
          snapshot={
            {
              ...(props.snapshot as object),
              tokens: [{ id: "1", owner: "test-uid", x: 3, y: 10, color: "hsl(0 0% 0%)" }],
            } as MainLayoutProps["snapshot"]
          }
        />,
      );
      expect(mapBoardProps.current?.cameraCommand).toBeNull();
      // Closing the Screen resumes the follow: the next cell change fires.
      // (The open screen carries its own party-named controls; the dock's is first.)
      fireEvent.click(screen.getAllByRole("button", { name: /party/i })[0]!);
      rerender(
        <MobileLayout
          {...props}
          snapshot={
            {
              ...(props.snapshot as object),
              tokens: [{ id: "1", owner: "test-uid", x: 3, y: 11, color: "hsl(0 0% 0%)" }],
            } as MainLayoutProps["snapshot"]
          }
        />,
      );
      expect(mapBoardProps.current?.cameraCommand).toMatchObject({ type: "focus-point", y: 575 });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("press-and-hold on the d-pad walks at the keyboard's cadence and stops on release", () => {
    vi.useFakeTimers();
    // jsdom has no PointerEvent, so fireEvent.pointer* would arrive with no
    // pointerId at all and every finger would look like the same one. A
    // minimal PointerEvent carrying pointerId is what the pad keys its hold on.
    const NativePointerEvent = window.PointerEvent;
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;
    try {
      const props = createDefaultProps();
      props.activeTool = "select";
      props.selectMode = true;
      props.selectedObjectIds = ["token:1"];
      const move = vi.fn();
      props.movement = { movableCount: 1, move };
      const { rerender, unmount } = render(<MobileLayout {...props} />);
      const right = screen.getByRole("button", { name: /^move right$/i });
      const down = screen.getByRole("button", { name: /^move down$/i });
      const f1 = { pointerId: 1 };
      const f2 = { pointerId: 2 };

      // The press steps at once; walking starts after the initial delay.
      fireEvent.pointerDown(right, f1);
      expect(move).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS - 1));
      expect(move).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1));
      expect(move).toHaveBeenCalledTimes(2);
      act(() => vi.advanceTimersByTime(HOLD_STEP_INTERVAL_MS * 2));
      expect(move).toHaveBeenCalledTimes(4);

      // Release, as a FINGER does it (measured): up, then out/leave, then the
      // compat click with detail 1. Not a fifth step; the walk is over.
      fireEvent.pointerUp(right, f1);
      fireEvent.pointerLeave(right, f1);
      fireEvent.click(right, { detail: 1 });
      act(() => vi.advanceTimersByTime(HOLD_STEP_INTERVAL_MS * 5));
      expect(move).toHaveBeenCalledTimes(4);

      // A gesture the browser claims (pointercancel) ends the walk too.
      fireEvent.pointerDown(right, f1);
      fireEvent.pointerCancel(right, f1);
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS * 2));
      expect(move).toHaveBeenCalledTimes(5);

      // A mouse released OFF the chip: capture is lost, the walk ends, and the
      // pad is not left dead — the next press still steps.
      fireEvent.pointerDown(right, { pointerId: 7 });
      fireEvent.lostPointerCapture(right, { pointerId: 7 });
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS * 2));
      expect(move).toHaveBeenCalledTimes(6);
      fireEvent.pointerDown(down, f1);
      fireEvent.pointerUp(down, f1);
      expect(move).toHaveBeenCalledTimes(7);

      // A second finger — on ANOTHER button, or the SAME one — while a hold
      // runs neither cuts the walk short nor adds a step: the walk keeps
      // going after the second finger lifts.
      fireEvent.pointerDown(right, f1);
      expect(move).toHaveBeenCalledTimes(8);
      fireEvent.pointerDown(down, f2);
      fireEvent.pointerUp(down, f2);
      fireEvent.click(down, { detail: 1 });
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS));
      expect(move).toHaveBeenCalledTimes(9); // the walk's first step, not cut short
      fireEvent.pointerDown(right, f2);
      fireEvent.pointerUp(right, f2);
      fireEvent.click(right, { detail: 1 });
      act(() => vi.advanceTimersByTime(HOLD_STEP_INTERVAL_MS));
      expect(move).toHaveBeenCalledTimes(10); // still walking after the same-button finger
      expect(move.mock.calls.at(-1)).toEqual([{ dx: 1, dy: 0 }]);
      fireEvent.pointerUp(right, f1);
      fireEvent.click(right, { detail: 1 });
      act(() => vi.advanceTimersByTime(HOLD_STEP_INTERVAL_MS * 3));
      expect(move).toHaveBeenCalledTimes(10);

      // A right-click (button 2) is a menu, not a press: no step, no hold.
      fireEvent.pointerDown(right, { pointerId: 9, button: 2 });
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS * 2));
      expect(move).toHaveBeenCalledTimes(10);

      // Without capture (jsdom has none, nor do some pens) a pointer that
      // LEAVES the chip ends the walk — no walk is unbounded.
      fireEvent.pointerDown(right, { pointerId: 8 });
      expect(move).toHaveBeenCalledTimes(11);
      fireEvent.pointerLeave(right, { pointerId: 8 });
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS * 2));
      expect(move).toHaveBeenCalledTimes(11);

      // A held Enter on a focused button is throttled to the same cadence —
      // per BUTTON, so focus moved to another chip still steps at once.
      for (let i = 0; i < 10; i += 1) fireEvent.click(right, { detail: 0 });
      expect(move).toHaveBeenCalledTimes(12);
      fireEvent.click(down, { detail: 0 });
      expect(move).toHaveBeenCalledTimes(13);
      act(() => vi.advanceTimersByTime(HOLD_STEP_INTERVAL_MS));
      fireEvent.click(right, { detail: 0 });
      expect(move).toHaveBeenCalledTimes(14);

      // Mid-walk the snapshot replaces `move`; the walk must follow it.
      const laterMove = vi.fn();
      fireEvent.pointerDown(right, f1);
      rerender(<MobileLayout {...props} movement={{ movableCount: 1, move: laterMove }} />);
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS));
      expect(laterMove).toHaveBeenCalledTimes(1);
      expect(move).toHaveBeenCalledTimes(15);

      // The pad unmounts mid-walk (selection cleared): the timer dies with it.
      unmount();
      act(() => vi.advanceTimersByTime(HOLD_START_DELAY_MS + HOLD_STEP_INTERVAL_MS * 5));
      expect(laterMove).toHaveBeenCalledTimes(1);
    } finally {
      (window as unknown as { PointerEvent: unknown }).PointerEvent = NativePointerEvent;
      vi.useRealTimers();
    }
  });

  it("no d-pad when nothing selected is movable by this actor — the sheet still shows", () => {
    const props = createDefaultProps();
    props.activeTool = "select";
    props.selectMode = true;
    props.selectedObjectIds = ["token:someone-elses"];
    props.movement = { movableCount: 0, move: vi.fn() };

    render(<MobileLayout {...props} />);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /move selection/i })).not.toBeInTheDocument();
  });

  it("the own-token fallback lights nothing here: a movable count with NO selection mounts no sheet and no pad", () => {
    // useKeyboardMovement reports movableCount 1 with an empty selection when
    // the actor runs one PC character (F4) — that is the keys' road. The
    // phone's pad lives in the selection sheet, which needs a selection.
    const props = createDefaultProps();
    props.activeTool = "select";
    props.selectMode = true;
    props.selectedObjectId = null;
    props.selectedObjectIds = [];
    props.movement = { movableCount: 1, move: vi.fn() };

    const { rerender } = render(<MobileLayout {...props} />);

    expect(
      screen.queryByRole("region", { name: "Selected object actions" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /move selection/i })).not.toBeInTheDocument();
    // Control: the same props DO mount the sheet — and the pad in it — once
    // something is selected.
    rerender(<MobileLayout {...props} selectedObjectIds={["token:someone-elses"]} />);
    const sheet = screen.getByRole("region", { name: "Selected object actions" });
    expect(within(sheet).getByRole("group", { name: /move selection/i })).toBeInTheDocument();
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

    it("an NPC's Focus from the DM screen centres its token and shows the map", async () => {
      const props = { ...createDefaultProps(), isDM: true };
      render(<MobileLayout {...props} />);
      fireEvent.click(dock(/^dm$/i));
      expect(openSurfaces()).toEqual(["dm"]);

      fireEvent.click(await screen.findByRole("button", { name: "Focus Goblin" }));

      expect(props.handleFocusToken).toHaveBeenCalledWith("t-goblin");
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

    describe("the kicked-in door (K3)", () => {
      const kickControls = (overrides: Partial<KickControls> = {}): KickControls => ({
        open: false,
        draft: null,
        updateDraft: vi.fn(),
        openKick: vi.fn(),
        closeKick: vi.fn(),
        kick: vi.fn(),
        pending: null,
        settings: {
          recipe: { recipeId: "dungeon", theme: "stone", density: "medium", size: "small" },
          linkType: "door",
        },
        canKick: true,
        ...overrides,
      });

      const dmProps = (kick: KickControls): MainLayoutProps => ({
        ...createDefaultProps(),
        isDM: true,
        kick,
      });

      it("the DM screen opens the shared Kick session through the surface machine", async () => {
        const kick = kickControls();
        render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        expect(openSurfaces()).toEqual(["dm"]);
        // An exact name: the Atlas tab's button says the same words in caps,
        // so a case-insensitive match would find both.
        fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));
        expect(openSurfaces()).toEqual(["kick"]);
        expect(screen.getByRole("dialog", { name: "Kick in a door" })).toBeInTheDocument();
        expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
        expect(kick.openKick).toHaveBeenCalledTimes(1);
      });

      it("a player's DM screen never exists, and no verb renders for them", () => {
        render(<KickLayoutUnderTest {...{ ...createDefaultProps(), kick: kickControls() }} />);
        expect(screen.queryByRole("button", { name: "🚪 Kick in a door" })).toBeNull();
        expect(openSurfaces()).toEqual([]);
      });

      it("losing DM while the kick screen is up takes the screen down with it", () => {
        // The guard is not about a player REACHING this surface — they have no
        // verb and no DM button. It is about de-elevation mid-screen: EXIT DM
        // MODE with the kick screen open must not leave an empty shell up, the
        // same rule the dm and props screens follow.
        const kick = kickControls();
        const { rerender } = render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(screen.getByRole("button", { name: "🚪 Kick in a door" }));
        expect(openSurfaces()).toEqual(["kick"]);

        rerender(<KickLayoutUnderTest {...{ ...createDefaultProps(), kick }} />);
        expect(openSurfaces()).toEqual([]);
        expect(screen.queryByTestId("kick-panel")).toBeNull();
      });

      it("the Atlas tab's button opens the same shared session and mounted screen", async () => {
        const kick = kickControls();
        render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(await screen.findByRole("button", { name: "🚪 KICK IN A DOOR" }));
        expect(openSurfaces()).toEqual(["kick"]);
        expect(kick.openKick).toHaveBeenCalledTimes(1);
      });

      // The twin of the ROLL test below, and the half K3 forgot: the slice
      // pinned that ROLL leaves the surface and never that CANCEL does, so
      // `closeKick` kept pointing at the desktop-only `open` flag — which
      // nothing on a phone reads. CANCEL and Escape were dead controls.
      it("the phone's kick screen offers START LIVE MAP too — the desktop is not the only half", async () => {
        // The panel test covers the button; only this one covers the phone
        // actually HANDING it the action. Deleting the mobile wiring left the
        // panel suite green, which is how a half-platform fix ships.
        const kick = kickControls({ canKick: false });
        const base = dmProps(kick);
        const onStartLiveMap = vi.fn();
        render(
          <KickLayoutUnderTest
            {...base}
            mapEditToolbarProps={{ ...base.mapEditToolbarProps, onStartLiveMap }}
          />,
        );
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));

        fireEvent.click(screen.getByRole("button", { name: "▶ START LIVE MAP" }));
        expect(onStartLiveMap).toHaveBeenCalledTimes(1);
      });

      it("CANCEL closes the shared session and leaves the surface", async () => {
        const kick = kickControls();
        render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));
        expect(openSurfaces()).toEqual(["kick"]);

        fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
        expect(openSurfaces()).toEqual([]);
        expect(screen.queryByTestId("kick-panel")).toBeNull();
        // ...and the App-level flag is cleared too, so a layout crossing back
        // to the desktop mount cannot find the two signals disagreeing.
        expect(kick.closeKick).toHaveBeenCalledTimes(1);
      });

      it("the screen's own ✕ closes the shared session", async () => {
        // The ✕ and the drag-down dismissal used to call the machine's
        // closeSurface directly, so they left the App-level `open` flag set —
        // and a later crossing to the desktop layout would find the panel
        // already open, with no one having asked for it.
        const kick = kickControls();
        render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));
        expect(openSurfaces()).toEqual(["kick"]);

        fireEvent.click(screen.getByRole("button", { name: "Close Kick in a door" }));
        expect(openSurfaces()).toEqual([]);
        expect(kick.closeKick).toHaveBeenCalledTimes(1);
      });

      it("Escape on the panel leaves the surface", async () => {
        const kick = kickControls();
        render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));

        fireEvent.keyDown(screen.getByTestId("kick-panel"), { key: "Escape" });
        expect(openSurfaces()).toEqual([]);
        expect(kick.closeKick).toHaveBeenCalledTimes(1);
      });

      it("ROLL sends the kick through the App-level controls and LEAVES the surface", async () => {
        const kick = kickControls();
        render(<KickLayoutUnderTest {...dmProps(kick)} />);
        fireEvent.click(dock(/^dm$/i));
        fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));
        fireEvent.submit(screen.getByTestId("kick-panel"));
        expect(kick.kick).toHaveBeenCalledTimes(1);
        expect(vi.mocked(kick.kick).mock.calls[0]?.[0]).toMatchObject({
          recipe: { recipeId: "dungeon", theme: "stone", density: "medium", size: "small" },
          linkType: "door",
        });
        expect(openSurfaces()).toEqual([]);
      });

      it("the ⏳ chip floats over the dock iff a kick is pending and not expired", () => {
        const pending = { nodeId: "n", name: "Cellar", startedAt: 0, expired: false };
        const { rerender } = render(
          <KickLayoutUnderTest {...dmProps(kickControls({ pending }))} />,
        );
        expect(screen.getByTestId("mobile-kick-pending")).toHaveTextContent("Kicking");
        rerender(
          <KickLayoutUnderTest
            {...dmProps(kickControls({ pending: { ...pending, expired: true } }))}
          />,
        );
        expect(screen.queryByTestId("mobile-kick-pending")).toBeNull();
        rerender(<KickLayoutUnderTest {...dmProps(kickControls({ pending: null }))} />);
        expect(screen.queryByTestId("mobile-kick-pending")).toBeNull();
      });
    });

    it("arming the link aim clears whatever surface is up — capturing needs the MAP (A6)", () => {
      const props = createDefaultProps();
      const { rerender } = render(<MobileLayout {...props} />);
      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual(["party"]);

      rerender(<MobileLayout {...{ ...props, linkAimActive: true }} />);
      expect(openSurfaces()).toEqual([]);
    });

    it("arming the aim while ALIGNMENT is already armed still clears the surface — the axis swap has no combined edge", () => {
      const props = createDefaultProps();
      props.alignmentMode = true;
      const { rerender } = render(<MobileLayout {...props} />);
      fireEvent.click(dock(/party/i));
      expect(openSurfaces()).toEqual(["party"]);

      // One commit: alignment falls as the aim rises (they share ToolMode).
      rerender(<MobileLayout {...{ ...props, alignmentMode: false, linkAimActive: true }} />);
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
      ["Chat", /chat/i],
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

    it("a KNOWN demotion ends the DM screen for good, so entering DM mode again leaves the map clear", async () => {
      // Leave DM mode (or a restart that cleared the elevation), then the next-steps card's
      // Enter DM mode: nothing on the phone may spring the old screen open over the map.
      const props = createDefaultProps();
      props.isDM = true;
      const { rerender } = render(<MobileLayout {...props} />);
      fireEvent.click(dock(/dm/i));
      expect(openSurfaces()).toEqual(["dm"]);
      rerender(<MobileLayout {...props} isDM={false} roleKnown />);
      expect(openSurfaces()).toEqual([]);
      rerender(<MobileLayout {...props} isDM roleKnown />);
      expect(openSurfaces()).toEqual([]);
    });

    it("a reconnect blip only hides the DM screen: it returns with the roster", async () => {
      const props = createDefaultProps();
      props.isDM = true;
      const { rerender } = render(<MobileLayout {...props} />);
      fireEvent.click(dock(/dm/i));
      rerender(<MobileLayout {...props} isDM={false} roleKnown={false} />);
      expect(openSurfaces()).toEqual([]);
      rerender(<MobileLayout {...props} isDM roleKnown />);
      expect(openSurfaces()).toEqual(["dm"]);
    });

    it("de-elevating with the DM screen open takes the shell down with it — and the machine with it, so the move-pad follow resumes", async () => {
      // A selected, movable token under the sheet (phone rects stubbed by
      // class): while the DM screen covers the map the follow is inert; once
      // the role drops and the screen unmounts, `surface` must read "none"
      // again or the follow stays inert with the map fully visible.
      const rectSpy = vi
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: HTMLElement) {
          const top = this.classList.contains("mobile-selection-sheet") ? 472 : 0;
          const height = this.classList.contains("mobile-map-surface") ? 812 : 300;
          return { top, left: 0, width: 375, height, bottom: top + height, right: 375 } as DOMRect;
        });
      try {
        const props = createDefaultProps();
        props.isDM = true;
        props.activeTool = "select";
        props.selectMode = true;
        props.selectedObjectIds = ["token:1"];
        props.movement = { movableCount: 1, move: vi.fn() };
        props.snapshot = {
          combatActive: false,
          tokens: [{ id: "1", owner: "someone", x: 3, y: 9, color: "hsl(0 0% 0%)" }],
          props: [],
          sceneObjects: [],
        } as unknown as MainLayoutProps["snapshot"];
        const { rerender } = render(<MobileLayout {...props} />);
        await screen.findByTestId("map-board");
        // The DM may move anyone's token: the follow fires on mount, and is
        // consumed so the screen case below starts clean.
        expect(mapBoardProps.current?.cameraCommand).toMatchObject({ type: "focus-point" });
        act(() => (mapBoardProps.current!.onCameraCommandHandled as () => void)());

        fireEvent.click(dock(/dm/i));
        expect(await screen.findByTestId("dm-menu-content")).toBeInTheDocument();

        // The server revokes DM (or Leave DM mode lands): the screen must not
        // stay up as an empty shell around a menu that renders null.
        rerender(<MobileLayout {...props} isDM={false} />);
        expect(screen.queryByRole("dialog", { name: "DM Menu" })).not.toBeInTheDocument();
        expect(openSurfaces()).toEqual([]);
        // Now a player: their own token, under the sheet, moved by a step.
        const own = {
          ...(props.snapshot as object),
          tokens: [{ id: "1", owner: "test-uid", x: 3, y: 10, color: "hsl(0 0% 0%)" }],
        } as MainLayoutProps["snapshot"];
        rerender(<MobileLayout {...props} isDM={false} snapshot={own} />);
        expect(mapBoardProps.current?.cameraCommand).toMatchObject({ type: "focus-point", y: 525 });
      } finally {
        rectSpy.mockRestore();
      }
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
      fireEvent.click(screen.getByRole("button", { name: "Close Chat & Rolls" }));
      expect(props.toggleRollLog).toHaveBeenCalledWith(false);
      unmount();
    });

    it("forwards opacity and shape fill from the same drawing controller to the phone", () => {
      const props = createDefaultProps();
      props.activeTool = "draw";
      props.drawMode = true;
      const onOpacityChange = vi.fn();
      const onFilledChange = vi.fn();
      props.drawingToolbarProps = {
        drawTool: "rect",
        drawColor: "#66cc66",
        drawWidth: 17,
        drawOpacity: 0.4,
        drawFilled: true,
        canUndo: false,
        canRedo: false,
        onToolChange: vi.fn(),
        onColorChange: vi.fn(),
        onWidthChange: vi.fn(),
        onOpacityChange,
        onFilledChange,
        onClearAll: vi.fn(),
        onClose: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
      };
      render(<MobileLayout {...props} />);
      const opacity = screen.getByRole("slider", { name: /Opacity/ });
      expect(opacity).toHaveValue("40");
      expect(screen.getByRole("checkbox", { name: "Filled" })).toBeChecked();
      fireEvent.change(opacity, { target: { value: "65" } });
      fireEvent.click(screen.getByRole("checkbox", { name: "Filled" }));
      expect(onOpacityChange).toHaveBeenCalledWith(0.65);
      expect(onFilledChange).toHaveBeenCalledWith(false);
    });

    it.each(["Tools", "Help"])(
      "retains hidden drawing controls through %s until drawing ends",
      (surface) => {
        const props = createDefaultProps();
        props.activeTool = "draw";
        props.drawMode = true;
        props.drawingToolbarProps = {
          drawTool: "rect",
          drawColor: "#66cc66",
          drawWidth: 17,
          drawOpacity: 0.4,
          drawFilled: true,
          canUndo: false,
          canRedo: false,
          onToolChange: vi.fn(),
          onColorChange: vi.fn(),
          onWidthChange: vi.fn(),
          onOpacityChange: vi.fn(),
          onFilledChange: vi.fn(),
          onClearAll: vi.fn(),
          onClose: vi.fn(),
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        };
        const { rerender } = render(<MobileLayout {...props} />);
        fireEvent.click(screen.getByRole("button", { name: "Hide drawing controls" }));
        fireEvent.click(dock(/tools/i));
        expect(screen.queryByRole("toolbar", { name: "Drawing tools" })).toBeNull();
        if (surface === "Help") {
          fireEvent.click(screen.getByRole("button", { name: /^help$/i }));
          fireEvent.click(screen.getByRole("button", { name: /close help/i }));
        } else {
          fireEvent.click(screen.getByRole("button", { name: /close tools/i }));
        }
        expect(screen.getByRole("button", { name: "Show drawing controls" })).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        expect(screen.queryByRole("slider")).toBeNull();
        expect(props.setActiveTool).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Show drawing controls" }));
        expect(screen.getByRole("slider", { name: "Opacity (%)" })).toHaveValue("40");
        expect(screen.getByRole("slider", { name: "Stroke width (px)" })).toHaveValue("17");
        expect(screen.getByRole("checkbox", { name: "Filled" })).toBeChecked();
        fireEvent.click(screen.getByRole("button", { name: "Hide drawing controls" }));
        rerender(<MobileLayout {...props} activeTool={null} drawMode={false} />);
        rerender(<MobileLayout {...props} />);
        expect(screen.getByRole("button", { name: "Hide drawing controls" })).toHaveAttribute(
          "aria-expanded",
          "true",
        );
      },
    );

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

  describe("the Table screen and the top stack (U9)", () => {
    const openSurfaces = () =>
      [...document.querySelectorAll("[data-mobile-surface]")].map((el) =>
        el.getAttribute("data-mobile-surface"),
      );
    const dock = (name: RegExp) =>
      within(screen.getByRole("navigation", { name: /mobile actions/i })).getByRole("button", {
        name,
      });
    const openTable = () => {
      fireEvent.click(dock(/tools/i));
      fireEvent.click(screen.getByRole("button", { name: "Table" }));
      return screen.getByRole("dialog", { name: "Table" });
    };

    beforeEach(() => {
      installMemoryStorage();
      __resetDMMenuRequestsForTests();
      window.history.replaceState(null, "", "/?room=table-abc123");
    });

    it("opens from a Table tile in the Tools sheet, as the one surface, with no sixth dock slot", () => {
      render(<MobileLayout {...createDefaultProps()} />);
      expect(
        within(screen.getByRole("navigation", { name: /mobile actions/i })).getAllByRole("button"),
      ).toHaveLength(5);

      const table = openTable();
      expect(openSurfaces()).toEqual(["table"]);
      expect(within(table).getByRole("heading", { name: "Your role" })).toBeInTheDocument();
      expect(within(table).getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
      expect(within(table).getByRole("group", { name: "Display" })).toBeInTheDocument();
      expect(within(table).getByRole("group", { name: "Sound & motion" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Close Table" }));
      expect(openSurfaces()).toEqual([]);
    });

    it("says the connection once on the Table screen: in its header row, not again in its body", () => {
      render(<MobileLayout {...createDefaultProps()} />);
      const table = openTable();
      const chips = within(table).getAllByTestId("connection-chip");
      expect(chips).toHaveLength(1);
      expect(table.querySelector(".mobile-screen__header")).toContainElement(chips[0]!);
    });

    it("gives a player Enter DM mode, which asks for the dialog and elevates nothing itself", () => {
      const props = createDefaultProps();
      render(<MobileLayout {...props} />);
      fireEvent.click(within(openTable()).getByRole("button", { name: "Enter DM mode" }));
      expect(props.handleToggleDM).toHaveBeenCalledExactlyOnceWith(true);
    });

    it("gives a DM Leave DM mode, and Table settings opens the DM screen on the Table tab", () => {
      const props = { ...createDefaultProps(), isDM: true };
      render(<MobileLayout {...props} />);
      const table = openTable();

      fireEvent.click(within(table).getByRole("button", { name: "Leave DM mode" }));
      expect(props.handleToggleDM).toHaveBeenCalledExactlyOnceWith(false);

      fireEvent.click(within(table).getByRole("button", { name: /Table settings/ }));
      expect(openSurfaces()).toEqual(["dm"]);
      // The request the DM menu takes when it mounts (the test's DM container is a stub).
      expect(takeDMMenuTabRequest()).toBe("table");
    });

    it("offers a player no Table settings", () => {
      render(<MobileLayout {...createDefaultProps()} />);
      expect(within(openTable()).queryByRole("button", { name: /Table settings/ })).toBeNull();
    });

    it("does not judge the role during a reconnect: nothing to enter or leave until the roster is back", () => {
      const props = { ...createDefaultProps(), isDM: true, roleKnown: false };
      render(<MobileLayout {...props} />);
      const table = openTable();
      expect(within(table).getByText("Reconnecting…")).toBeInTheDocument();
      expect(within(table).queryByRole("button", { name: "Leave DM mode" })).toBeNull();
      expect(within(table).queryByRole("button", { name: /Table settings/ })).toBeNull();
    });

    it("carries the connection in every screen's own header, and never as a fixed badge", () => {
      const props = createDefaultProps();
      const { rerender } = render(<MobileLayout {...props} />);
      fireEvent.click(dock(/party/i));
      const party = screen.getByRole("dialog", { name: "Party Members" });
      const chip = within(party).getByRole("status");
      expect(chip).toHaveTextContent("ONLINE");
      // In the header's own row: a descendant of the header, where the title is.
      expect(party.querySelector(".mobile-screen__header")).toContainElement(chip);

      rerender(<MobileLayout {...props} isConnected={false} />);
      expect(
        within(screen.getByRole("dialog", { name: "Party Members" })).getByRole("status"),
      ).toHaveTextContent("OFFLINE");
    });

    it("tells the truth on EVERY screen when the server is lost — each passes the real state, not a constant", () => {
      // Each screen is built by its own branch of MobileSurfaces; one that hard-wired
      // "online" would show a cheerful chip over a dead table. Party was the only one checked.
      const screens: Array<[string, Partial<MainLayoutProps>, () => void]> = [
        ["Party Members", {}, () => fireEvent.click(dock(/party/i))],
        // The chat log is a prop-controlled surface: the layout's own state says it is open.
        ["Chat & Rolls", { rollLogOpen: true }, () => undefined],
        ["DM Menu", {}, () => fireEvent.click(dock(/dm/i))],
        [
          "Table",
          {},
          () => {
            fireEvent.click(dock(/tools/i));
            fireEvent.click(screen.getByRole("button", { name: "Table" }));
          },
        ],
        // Seven screens, seven branches of MobileSurfaces, seven separate isConnected props: the
        // four above were all this test once looked at. The Kick screen is below, with its layout.
        [
          "Props",
          {
            isDM: false,
            snapshot: {
              ...createDefaultProps().snapshot,
              playerPropsEnabled: true,
            } as MainLayoutProps["snapshot"],
          },
          () => {
            fireEvent.click(dock(/tools/i));
            fireEvent.click(screen.getByRole("button", { name: /^props$/i }));
          },
        ],
        [
          "World Map",
          { isDM: false },
          () => {
            fireEvent.click(dock(/tools/i));
            fireEvent.click(screen.getByRole("button", { name: /^world$/i }));
          },
        ],
      ];
      for (const [name, extra, open] of screens) {
        const props = { ...createDefaultProps(), isDM: true, isConnected: false, ...extra };
        const { unmount } = render(<MobileLayout {...props} />);
        open();
        const dialog = screen.getByRole("dialog", { name });
        expect(within(dialog).getByTestId("connection-chip"), name).toHaveTextContent("OFFLINE");
        unmount();
      }
    });

    it("tells the truth on the dice overlay when the server is lost, too", () => {
      // It covers the whole screen, the top stack's chip with it, so it carries its own.
      render(<MobileLayout {...createDefaultProps()} diceRollerOpen isConnected={false} />);
      const roller = screen.getByTestId("dice-roller");
      expect(within(roller).getByTestId("connection-chip")).toHaveTextContent("OFFLINE");
    });

    it("tells the truth on the Kick screen when the server is lost, too", async () => {
      const kick: KickControls = {
        open: false,
        draft: null,
        updateDraft: vi.fn(),
        openKick: vi.fn(),
        closeKick: vi.fn(),
        kick: vi.fn(),
        pending: null,
        settings: {
          recipe: { recipeId: "dungeon", theme: "stone", density: "medium", size: "small" },
          linkType: "door",
        },
        canKick: true,
      };
      render(
        <KickLayoutUnderTest
          {...{ ...createDefaultProps(), isDM: true, isConnected: false, kick }}
        />,
      );
      fireEvent.click(dock(/^dm$/i));
      fireEvent.click(await screen.findByRole("button", { name: "🚪 Kick in a door" }));
      const dialog = screen.getByRole("dialog", { name: "Kick in a door" });
      expect(within(dialog).getByTestId("connection-chip")).toHaveTextContent("OFFLINE");
    });

    it("gives the gate's reconnect notice a place in that column, right after the chip", () => {
      // It was a fixed banner at the top right, and 26px of it lay over the OFFLINE chip.
      render(
        <ReconnectPhaseContext.Provider value="reconnecting">
          <MobileLayout {...createDefaultProps()} isConnected={false} />
        </ReconnectPhaseContext.Provider>,
      );
      const stack = document.querySelector(".mobile-top-stack") as HTMLElement;
      const chip = within(stack).getByTestId("connection-chip");
      const notice = within(stack).getByTestId("reconnect-notice");
      expect(chip.compareDocumentPosition(notice)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(document.querySelectorAll('[data-testid="reconnect-notice"]')).toHaveLength(1);
    });

    it("stacks the connection, the public-table warning and the turn strip in ONE column over the map", () => {
      const props = createDefaultProps();
      props.snapshot = {
        isPublicTable: true,
        combatActive: true,
        currentTurnCharacterId: "c1",
        characters: [{ id: "c1", name: "Ranger", type: "pc", hp: 9, maxHp: 9 }],
      } as unknown as MainLayoutProps["snapshot"];
      render(<MobileLayout {...props} />);

      const stack = document.querySelector(".mobile-top-stack") as HTMLElement;
      expect(stack).not.toBeNull();
      const chip = within(stack).getByTestId("connection-chip");
      const warning = within(stack).getByTestId("public-table-chip");
      const strip = stack.querySelector(".mobile-combat-strip") as HTMLElement;
      expect(strip).not.toBeNull();
      // One column, in this order: nothing can be painted over anything else.
      expect(chip.compareDocumentPosition(warning)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(warning.compareDocumentPosition(strip)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      // And there is no other, fixed copy of the chip on the page.
      expect(document.querySelectorAll('[data-testid="connection-chip"]')).toHaveLength(1);
    });

    it("keeps the public-table warning through a reconnect blip, so the stack does not jump", () => {
      // The warning is a member of the in-flow stack: one that went with the snapshot moved
      // the strip and the chip under it on every reconnect.
      const props = createDefaultProps();
      props.snapshot = { isPublicTable: true } as unknown as MainLayoutProps["snapshot"];
      const { rerender } = render(<MobileLayout {...props} />);
      expect(screen.getByTestId("public-table-chip")).toBeInTheDocument();
      rerender(<MobileLayout {...props} snapshot={null} isConnected={false} roleKnown={false} />);
      expect(screen.getByTestId("public-table-chip")).toBeInTheDocument();
    });

    it("shows the host's next steps in the stack only in the tab that just made the table", () => {
      const props = createDefaultProps();
      const { unmount } = render(<MobileLayout {...props} />);
      expect(screen.queryByRole("region", { name: "Next steps for the host" })).toBeNull();
      unmount();

      markNewTable("table-abc123");
      render(<MobileLayout {...props} />);
      const steps = screen.getByRole("region", { name: "Next steps for the host" });
      expect(document.querySelector(".mobile-top-stack")).toContainElement(steps);
      fireEvent.click(within(steps).getByRole("button", { name: "Enter DM mode" }));
      expect(props.handleToggleDM).toHaveBeenCalledExactlyOnceWith(true);
    });

    it("gives the viewer's own row Save character / Load character, and no DM Mode control in it", () => {
      const props = createDefaultProps();
      props.snapshot = {
        players: [{ uid: "test-uid", name: "Me", isDM: false, hp: 9, maxHp: 9 }],
        characters: [
          { id: "char-1", name: "Me", type: "pc", ownedByPlayerUID: "test-uid", hp: 9, maxHp: 9 },
        ],
        tokens: [],
        sceneObjects: [],
        drawings: [],
      } as unknown as MainLayoutProps["snapshot"];
      render(<MobileLayout {...props} />);
      fireEvent.click(dock(/party/i));
      fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));
      expect(screen.getByRole("button", { name: "Save character" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Load character…" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /DM Mode/i })).toBeNull();
    });

    it("hands the party list the table's drawings and the layout's own apply", async () => {
      // The list's own tests supply both themselves, so they cannot see a layout that forgot to:
      // a Save would hold no drawings (or everyone's), and a Load would change nothing.
      vi.mocked(savePlayerState).mockClear();
      const applyPlayerState = vi.fn();
      const props = {
        ...createDefaultProps(),
        playerActions: { applyPlayerState } as unknown as PlayerActions,
      };
      props.snapshot = {
        players: [{ uid: "test-uid", name: "Me", isDM: false, hp: 9, maxHp: 9 }],
        characters: [
          {
            id: "char-1",
            name: "Me",
            type: "pc",
            ownedByPlayerUID: "test-uid",
            hp: 9,
            maxHp: 9,
            tokenId: "tok-1",
          },
        ],
        tokens: [{ id: "tok-1", owner: "test-uid", x: 1, y: 1, color: "red" }],
        sceneObjects: [],
        drawings: [
          {
            id: "d-mine",
            owner: "test-uid",
            type: "freehand",
            points: [],
            color: "#fff",
            width: 2,
          },
          {
            id: "d-theirs",
            owner: "someone",
            type: "freehand",
            points: [],
            color: "#fff",
            width: 2,
          },
        ],
      } as unknown as MainLayoutProps["snapshot"];
      render(<MobileLayout {...props} />);
      fireEvent.click(dock(/party/i));
      fireEvent.click(screen.getByRole("button", { name: /EDIT/ }));

      fireEvent.click(screen.getByRole("button", { name: "Save character" }));
      const saved = vi.mocked(savePlayerState).mock.calls[0]![0];
      expect(saved.drawings?.map((drawing) => drawing.id)).toEqual(["d-mine"]);

      const input = screen.getByLabelText("Choose a character file to load");
      const file = { text: async () => JSON.stringify({ name: "Aria", hp: 4, maxHp: 9 }) };
      fireEvent.change(input, { target: { files: [file] } });
      await vi.waitFor(() => expect(applyPlayerState).toHaveBeenCalledTimes(1));
      const [state, tokenId, characterId] = applyPlayerState.mock.calls[0]!;
      expect(state).toMatchObject({ name: "Aria", hp: 4, maxHp: 9 });
      expect([tokenId, characterId]).toEqual(["tok-1", "char-1"]);
    });
  });
});
