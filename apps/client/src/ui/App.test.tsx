import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import React from "react";
import { AuthState, ConnectionState } from "../services/websocket";
import { App } from "./App";
import { getSessionUID } from "../utils/session";
import { useDMRole } from "../hooks/useDMRole";

const mockUseWebSocket = vi.fn();
const mockUseObjectSelection = vi.fn();
let latestHeaderProps: {
  onToolSelect: (mode: string | null) => void;
  table?: { isDM: boolean; onToggleDM: (next: boolean) => void };
  playerLens?: boolean;
  onPlayerLensChange?: (enabled: boolean) => void;
} | null = null;
let latestMapBoardProps: Record<string, unknown> | null = null;
let latestPanelRoleKnown: boolean | null = null;
let selectionMock: {
  selectedObjectId: string | null;
  selectedObjectIds: string[];
  selectObject: ReturnType<typeof vi.fn>;
  selectMultiple: ReturnType<typeof vi.fn>;
  isSelected: ReturnType<typeof vi.fn>;
  deselect: ReturnType<typeof vi.fn>;
};

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: (options: unknown) => mockUseWebSocket(options),
}));

vi.mock("../hooks/useObjectSelection", () => ({
  useObjectSelection: (options: unknown) => mockUseObjectSelection(options),
}));

vi.mock("./useVoiceChat", () => ({
  useVoiceChat: vi.fn(),
}));

vi.mock("../hooks/useMicrophone", () => ({
  useMicrophone: vi.fn(() => ({
    micEnabled: false,
    micStream: null,
    toggleMic: vi.fn(),
  })),
}));

vi.mock("../hooks/useDrawingState", () => ({
  useDrawingState: vi.fn(() => ({
    drawTool: "pencil",
    drawColor: "#ffffff",
    drawWidth: 4,
    drawOpacity: 1,
    drawFilled: false,
    canUndo: false,
    canRedo: false,
    setDrawTool: vi.fn(),
    setDrawColor: vi.fn(),
    setDrawWidth: vi.fn(),
    setDrawOpacity: vi.fn(),
    setDrawFilled: vi.fn(),
    addToHistory: vi.fn(),
    popFromHistory: vi.fn(),
    popFromRedoHistory: vi.fn(),
    clearHistory: vi.fn(),
  })),
}));

vi.mock("../hooks/usePlayerEditing", () => ({
  usePlayerEditing: vi.fn(() => ({
    editingPlayerUID: null,
    nameInput: "",
    editingMaxHpUID: null,
    maxHpInput: "10",
    startNameEdit: vi.fn(),
    updateNameInput: vi.fn(),
    submitNameEdit: vi.fn((handler: (name: string) => void) => handler("Test Hero")),
    startMaxHpEdit: vi.fn(),
    updateMaxHpInput: vi.fn(),
    submitMaxHpEdit: vi.fn((handler: (maxHp: number) => void) => handler(10)),
  })),
}));

vi.mock("../hooks/useHeartbeat", () => ({
  useHeartbeat: vi.fn(),
}));

vi.mock("../hooks/useDMRole", async (importActual) => ({
  // The real useClearOnDemotion stays: it is the App's wiring under test below.
  ...(await importActual<typeof import("../hooks/useDMRole")>()),
  useDMRole: vi.fn(() => ({
    isDM: true,
    roleKnown: true,
    toggleDM: vi.fn(),
  })),
}));

let latestDMMenuProps: Record<string, unknown> | null = null;

vi.mock("../features/dm/lazy-entry", () => ({
  DMMenuContainer: (props: Record<string, unknown>) => {
    latestDMMenuProps = props;
    return <div data-testid="dm-menu">DM Menu</div>;
  },
}));

vi.mock("../features/drawing/components", () => ({
  DrawingToolbar: vi.fn(() => <div data-testid="drawing-toolbar">Toolbar</div>),
}));

vi.mock("../components/layout/Header", () => ({
  Header: (props: NonNullable<typeof latestHeaderProps>) => {
    latestHeaderProps = props;
    return <div data-testid="header">Header</div>;
  },
}));

vi.mock("../components/layout/EntitiesPanel", async () => {
  const { useRoleKnown } = await import("../features/table/roleKnown");
  return {
    EntitiesPanel: () => {
      latestPanelRoleKnown = useRoleKnown();
      return <div data-testid="entities-panel">Entities</div>;
    },
  };
});

vi.mock("../components/dice/DiceRoller", () => ({
  DiceRoller: () => <div data-testid="dice-roller">Dice Roller</div>,
}));

vi.mock("../components/dice/RollLog", () => ({
  RollLog: () => <div data-testid="roll-log">Roll Log</div>,
}));

vi.mock("../utils/session", async (importActual) => ({
  ...(await importActual<typeof import("../utils/session")>()),
  getSessionUID: vi.fn(() => "test-uid"),
}));

vi.mock("../utils/sessionPersistence", () => ({
  saveSession: vi.fn(),
  loadSession: vi.fn(async () => null),
}));

vi.mock("./MapBoard", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    latestMapBoardProps = props;
    return <div data-testid="map-board">Map Board</div>;
  },
}));

const baseWebSocketState = {
  snapshot: null,
  connectionState: ConnectionState.CONNECTED,
  send: vi.fn(),
  authState: AuthState.UNAUTHENTICATED,
  authError: null,
  isConnected: true,
  authenticate: vi.fn(),
  connect: vi.fn(),
  registerRtcHandler: vi.fn(),
  registerServerEventHandler: vi.fn(),
  registerCommandDropHandler: vi.fn(),
};

const buildSnapshot = () => ({
  diceRolls: [],
  users: [],
  tokens: [
    {
      id: "token-1",
      owner: "test-uid",
      x: 0,
      y: 0,
      color: "#fff",
    },
    {
      id: "token-2",
      owner: "player-2",
      x: 1,
      y: 0,
      color: "#f00",
    },
  ],
  drawings: [],
  pointers: [],
  players: [
    {
      uid: "test-uid",
      name: "Player One",
      hp: 10,
      maxHp: 12,
    },
  ],
  characters: [],
  sceneObjects: [
    {
      id: "token:token-1",
      type: "token",
      owner: "test-uid",
      locked: false,
      zIndex: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { color: "#fff", size: "medium" },
    },
    {
      id: "token:token-2",
      type: "token",
      owner: "player-2",
      locked: false,
      zIndex: 1,
      transform: { x: 1, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { color: "#f00", size: "medium" },
    },
  ],
  gridSize: 50,
  gridSquareSize: 5,
  mapBackground: null,
  selectionState: {},
});

describe("App", () => {
  beforeEach(() => {
    latestPanelRoleKnown = null;
    mockUseWebSocket.mockReset();
    mockUseObjectSelection.mockReset();
    selectionMock = {
      selectedObjectId: null,
      selectedObjectIds: [],
      selectObject: vi.fn(),
      selectMultiple: vi.fn(),
      isSelected: vi.fn(),
      deselect: vi.fn(),
    };
    mockUseObjectSelection.mockImplementation(() => selectionMock);
    latestHeaderProps = null;
    latestMapBoardProps = null;
    latestDMMenuProps = null;
  });

  it("reads its identity once — a re-render must not re-mint it under a live session", () => {
    // getSessionUID mints and stores a uid when the key is absent, and another
    // tab's "start a fresh session" removes that key: read on every render, the
    // next snapshot would silently turn this tab into a stranger.
    vi.mocked(getSessionUID).mockClear();
    mockUseWebSocket.mockReturnValue({ ...baseWebSocketState });
    const { rerender } = render(<App />);
    rerender(<App />);
    rerender(<App />);

    expect(getSessionUID).toHaveBeenCalledTimes(1);
  });

  it("renders the auth gate when the user is not authenticated", () => {
    mockUseWebSocket.mockReturnValue({ ...baseWebSocketState });

    render(<App />);

    expect(screen.getByText(/Join Your Table/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Table password/i)).toBeInTheDocument();
  });

  it("renders the authenticated layout once authentication succeeds", async () => {
    const snapshot = {
      diceRolls: [],
      users: [],
      tokens: [],
      drawings: [],
      pointers: [],
      players: [
        {
          uid: "player-1",
          name: "Player One",
          hp: 10,
          maxHp: 12,
          portrait: null,
          tokenImage: null,
        },
      ],
      characters: [],
      sceneObjects: [
        {
          id: "map-1",
          type: "map",
          transform: {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
          locked: false,
          metadata: {},
        },
      ],
      gridSize: 50,
      gridSquareSize: 5,
      mapBackground: null,
    };

    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("dm-menu")).toBeInTheDocument();
    });

    expect(screen.getByTestId("map-board")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("entities-panel")).toBeInTheDocument();
  });

  it("appends selection when MapBoard requests append mode", async () => {
    selectionMock = {
      selectedObjectId: null,
      selectedObjectIds: [],
      selectObject: vi.fn(),
      selectMultiple: vi.fn(),
      isSelected: vi.fn(),
      deselect: vi.fn(),
    };
    mockUseObjectSelection.mockImplementation(() => selectionMock);

    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });

    render(<App />);

    await waitFor(() => expect(latestMapBoardProps).not.toBeNull());

    const onSelectObject = latestMapBoardProps!.onSelectObject as (
      id: string | null,
      options?: { mode?: string },
    ) => void;

    onSelectObject("token:token-1", { mode: "replace" });
    expect(selectionMock.selectObject).toHaveBeenCalledWith("token:token-1");

    onSelectObject("token:token-2", { mode: "append" });
    expect(selectionMock.selectMultiple).toHaveBeenCalledWith(["token:token-2"], "append");
  });

  it("toggles selection when MapBoard requests toggle mode for an already-selected object", async () => {
    selectionMock = {
      selectedObjectId: "token:token-1",
      selectedObjectIds: ["token:token-1"],
      selectObject: vi.fn(),
      selectMultiple: vi.fn(),
      isSelected: vi.fn(),
      deselect: vi.fn(),
    };
    mockUseObjectSelection.mockImplementation(() => selectionMock);

    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });

    render(<App />);

    await waitFor(() => expect(latestMapBoardProps).not.toBeNull());

    const onSelectObject = latestMapBoardProps!.onSelectObject as (
      id: string | null,
      options?: { mode?: string },
    ) => void;

    onSelectObject("token:token-1", { mode: "toggle" });
    expect(selectionMock.selectMultiple).toHaveBeenCalledWith(["token:token-1"], "subtract");
    expect(selectionMock.selectObject).not.toHaveBeenCalled();
  });

  it("deletes a selected token and clears selection when DM confirms", async () => {
    const deselect = vi.fn();
    selectionMock = {
      selectedObjectId: "token:token-1",
      selectedObjectIds: ["token:token-1"],
      selectObject: vi.fn(),
      selectMultiple: vi.fn(),
      isSelected: vi.fn(),
      deselect,
    };
    mockUseObjectSelection.mockImplementation(() => selectionMock);

    const sendMessage = vi.fn();
    const snapshot = {
      users: [],
      tokens: [
        {
          id: "token-1",
          owner: "player-1",
          x: 0,
          y: 0,
          color: "#fff",
        },
      ],
      drawings: [],
      pointers: [],
      players: [
        {
          uid: "player-1",
          name: "Player One",
          hp: 10,
          maxHp: 12,
        },
      ],
      characters: [],
      sceneObjects: [
        {
          id: "token:token-1",
          type: "token",
          owner: "player-1",
          locked: false,
          zIndex: 1,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { color: "#fff" },
        },
      ],
      gridSize: 50,
      gridSquareSize: 5,
      mapBackground: null,
      selectionState: {},
      diceRolls: [],
    };

    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot,
      send: sendMessage,
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("dm-menu")).toBeInTheDocument());

    deselect.mockClear(); // Ignore initial clear on mount

    fireEvent.keyDown(window, { key: "Delete" });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "token-1" });
    expect(deselect).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("wires the own-token fallback (F4): a bare key steps the actor's one PC with nothing selected, and a tool that owns the keys or the selection takes it down", async () => {
    const sendMessage = vi.fn();
    const snapshot = {
      ...buildSnapshot(),
      characters: [
        { id: "c1", name: "Dee", type: "pc", ownedByPlayerUID: "test-uid", tokenId: "token-1" },
      ],
    };
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot,
      send: sendMessage,
    });

    render(<App />);
    await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());

    const press = () =>
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "d", bubbles: true, cancelable: true }),
        );
      });

    press();
    expect(sendMessage).toHaveBeenCalledWith({
      t: "step-object",
      ids: ["token:token-1"],
      dx: 1,
      dy: 0,
    });

    for (const tool of ["draw", "select", "transform", "align", "atlas-link"] as const) {
      sendMessage.mockClear();
      act(() => latestHeaderProps!.onToolSelect(tool));
      press();
      expect(sendMessage, `${tool} must own the keys`).not.toHaveBeenCalled();
    }
    act(() => latestHeaderProps!.onToolSelect(null));
    sendMessage.mockClear();
    press();
    expect(sendMessage).toHaveBeenCalledWith({
      t: "step-object",
      ids: ["token:token-1"],
      dx: 1,
      dy: 0,
    });
    // A composing tool owns the keys even with a selection on hand; a selection
    // tool keeps the selected road.
    selectionMock.selectedObjectIds = ["token:token-1"];
    for (const [tool, steps] of [
      ["draw", false],
      ["align", false],
      ["atlas-link", false],
      ["select", true],
      ["transform", true],
    ] as const) {
      sendMessage.mockClear();
      act(() => latestHeaderProps!.onToolSelect(tool));
      press();
      if (steps) expect(sendMessage, `${tool} keeps the selected road`).toHaveBeenCalled();
      else expect(sendMessage, `${tool} owns the keys, selection or not`).not.toHaveBeenCalled();
    }
  });

  it("preserves selection from Transform to Move and clears it for Draw", async () => {
    const deselect = vi.fn();
    selectionMock = {
      selectedObjectId: "token:token-1",
      selectedObjectIds: ["token:token-1"],
      selectObject: vi.fn(),
      selectMultiple: vi.fn(),
      isSelected: vi.fn(),
      deselect,
    };
    mockUseObjectSelection.mockImplementation(() => selectionMock);

    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("dm-menu")).toBeInTheDocument());
    await waitFor(() => expect(latestHeaderProps).not.toBeNull());

    expect(deselect).not.toHaveBeenCalled();

    await act(async () => {
      latestHeaderProps!.onToolSelect("transform");
    });

    expect(deselect).not.toHaveBeenCalled();
    expect(latestMapBoardProps?.transformMode).toBe(true);

    await act(async () => {
      latestHeaderProps!.onToolSelect(null);
    });

    expect(latestMapBoardProps?.transformMode).toBe(false);
    expect(deselect).not.toHaveBeenCalled();

    await act(async () => {
      latestHeaderProps!.onToolSelect("draw");
    });

    expect(latestMapBoardProps?.drawMode).toBe(true);
    expect(deselect).toHaveBeenCalledTimes(1);
  });

  it("allows DM to update the room password", async () => {
    const send = vi.fn();
    const snapshot = buildSnapshot();

    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot,
      send,
    });

    render(<App />);

    await waitFor(() => expect(latestDMMenuProps).not.toBeNull());

    const onSetRoomPassword = latestDMMenuProps?.onSetRoomPassword as
      | ((secret: string) => void)
      | undefined;
    expect(onSetRoomPassword).toBeDefined();

    await act(async () => {
      onSetRoomPassword?.("Secret123");
    });
    expect(send).toHaveBeenCalledWith({ t: "set-room-password", secret: "Secret123" });
  });
  // ---------------------------------------------------------------------
  // The map-edit mode across a reconnect (M4c review finding).
  //
  // These live at the App level and not in useMapEditState's own suite for a
  // measured reason: with `snapshotLoaded` hard-coded to true at THIS call
  // site, every hook-level test still passes. The wiring is the thing under
  // test, and only App can drive isDM and the snapshot together the way a
  // real socket drop does.
  // ---------------------------------------------------------------------
  const armMapEdit = async () => {
    await waitFor(() => expect(latestHeaderProps).not.toBeNull());
    await act(async () => {
      latestHeaderProps!.onToolSelect("map-edit");
    });
    await waitFor(() => expect(latestMapBoardProps?.mapEditMode).toBe(true));
  };

  it("keeps map-edit armed across a socket drop — a null snapshot is not a revocation", async () => {
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });

    const { rerender } = render(<App />);
    await armMapEdit();

    // The socket closes: authManager.reset() nulls the snapshot, so isDM —
    // which is DERIVED from it — reads false. The app stays MOUNTED behind
    // AuthenticationGate's Reconnecting banner, which is what makes this
    // reachable at all.
    vi.mocked(useDMRole).mockReturnValue({
      isDM: false,
      roleKnown: false,
      elevateToDM: vi.fn(),
    });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: null,
    });
    await act(async () => {
      rerender(<App />);
    });

    expect(latestMapBoardProps?.mapEditMode).toBe(true);

    // ...and it is still armed once the table comes back.
    vi.mocked(useDMRole).mockReturnValue({ isDM: true, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });
    await act(async () => {
      rerender(<App />);
    });

    expect(latestMapBoardProps?.mapEditMode).toBe(true);
  });

  // The DM's snapshot cache keeps a DM's NPCs and tokens on screen through a reconnect
  // (every socket close nulls the snapshot). It must end with the role.
  const asDMThenBlip = async () => {
    // Explicitly a DM: mockReturnValue outlives the test that set it, and a neighbour that
    // left the role at "not a DM" made this suite pass with the cache never filled.
    vi.mocked(useDMRole).mockReturnValue({ isDM: true, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });
    const view = render(<App />);
    await waitFor(() => expect(latestMapBoardProps?.snapshot).toBeTruthy());
    return view;
  };
  const blip = async (rerender: (ui: React.ReactElement) => void) => {
    vi.mocked(useDMRole).mockReturnValue({ isDM: false, roleKnown: false, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: null,
    });
    await act(async () => {
      rerender(<App />);
    });
  };

  it("keeps a DM's own snapshot on screen through a reconnect blip", async () => {
    const { rerender } = await asDMThenBlip();
    await blip(rerender);
    expect(latestMapBoardProps?.snapshot).toBeTruthy();
  });

  // Editors that close on losing DM rights read this, so the blip above (cached roster,
  // DM flag false) is not taken for a demotion (features/table/roleKnown).
  it("tells the layouts the role is unknown through the blip, and known again after", async () => {
    const { rerender } = await asDMThenBlip();
    expect(latestPanelRoleKnown).toBe(true);
    await blip(rerender);
    expect(latestPanelRoleKnown).toBe(false);

    vi.mocked(useDMRole).mockReturnValue({ isDM: true, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });
    await act(async () => {
      rerender(<App />);
    });
    expect(latestPanelRoleKnown).toBe(true);
  });

  it("does NOT keep a demoted DM's snapshot to paint over a later reconnect", async () => {
    const { rerender } = await asDMThenBlip();
    // A restart cleared the elevation: the roster is back, it lists this seat, it is no DM.
    vi.mocked(useDMRole).mockReturnValue({ isDM: false, roleKnown: true, elevateToDM: vi.fn() });
    await act(async () => {
      rerender(<App />);
    });
    // The next blip must show what a player's blip shows — nothing of the DM's table.
    await blip(rerender);
    expect(latestMapBoardProps?.snapshot ?? null).toBeNull();
  });

  it("ends Player View when the server says you are no longer a DM, and not for a blip", async () => {
    // Player View is the DM's lens. Left on through a Leave it came back pressed at the next
    // elevation, and for the player in between it chose the party's tokens for the fog.
    const { rerender } = await asDMThenBlip();
    await waitFor(() => expect(latestHeaderProps).not.toBeNull());
    await act(async () => {
      latestHeaderProps!.onPlayerLensChange?.(true);
    });
    await waitFor(() => expect(latestHeaderProps?.playerLens).toBe(true));

    await blip(rerender);
    expect(latestHeaderProps?.playerLens).toBe(true);

    // The roster is back, it lists this seat, it is no DM.
    vi.mocked(useDMRole).mockReturnValue({ isDM: false, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });
    await act(async () => {
      rerender(<App />);
    });
    await waitFor(() => expect(latestHeaderProps?.playerLens).toBe(false));
  });

  // The phone layout has no Player View control and its map ignores the lens, yet the lens
  // still nulled map edit's previews there, with nothing on the phone to turn it off.
  it("ends Player View when the layout becomes the phone's", async () => {
    const size = [window.innerWidth, window.innerHeight];
    const resize = async (width: number, height: number) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
      await act(async () => {
        window.dispatchEvent(new Event("resize"));
      });
    };
    try {
      await asDMThenBlip();
      await waitFor(() => expect(latestHeaderProps).not.toBeNull());
      await act(async () => {
        latestHeaderProps!.onPlayerLensChange?.(true);
      });
      await waitFor(() => expect(latestHeaderProps?.playerLens).toBe(true));

      await resize(375, 450); // a tablet rotated into the phone layout
      await resize(1366, 768); // and back: the desktop header shows the lens state
      await waitFor(() => expect(latestHeaderProps?.playerLens).toBe(false));
    } finally {
      await resize(size[0]!, size[1]!);
    }
  });

  // Leaving DM mode is optimistic: the moment it is confirmed the app stops acting as the
  // DM, and waits for the server to agree.
  const dmSnapshot = () => ({
    ...buildSnapshot(),
    players: [{ uid: "test-uid", name: "Hero", isDM: true }],
  });
  const asTheDM = () => {
    vi.mocked(useDMRole).mockReturnValue({ isDM: true, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: dmSnapshot(),
    });
  };
  const confirmLeave = async () => {
    await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(true));
    await act(async () => {
      latestHeaderProps!.table!.onToggleDM(false);
    });
    fireEvent.click(await screen.findByRole("button", { name: "Leave DM mode" }));
  };

  it("stops acting as the DM the moment the leave is confirmed", async () => {
    asTheDM();
    render(<App />);
    await confirmLeave();
    await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(false));
  });

  it("is the DM again when the server never answers the leave", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      asTheDM();
      render(<App />);
      await confirmLeave();
      await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(false));

      // No answer for the length of the request (the leave was dropped, or the server is slow):
      // the roster still lists this seat as the DM, so it is one. Left latched, the Table menu
      // read "Player", offered no Leave, and Enter DM mode did nothing until a reload.
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(true));
    } finally {
      vi.useRealTimers();
    }
  });

  it("is the DM again at the next elevation once the server has confirmed the leave", async () => {
    // The wait ends when the roster says the seat is no DM; left standing it would keep the next
    // elevation's tools away.
    asTheDM();
    const { rerender } = render(<App />);
    await confirmLeave();

    vi.mocked(useDMRole).mockReturnValue({ isDM: false, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: { ...buildSnapshot(), players: [{ uid: "test-uid", name: "Hero", isDM: false }] },
    });
    await act(async () => {
      rerender(<App />);
    });
    await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(false));

    asTheDM();
    await act(async () => {
      rerender(<App />);
    });
    await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(true));
  });

  it("keeps waiting for the leave through a reconnect blip, and does not flash the DM back", async () => {
    // The socket dies under the confirm: the snapshot goes, and the DM flag with it, though nobody
    // has stopped being a DM. The wait has to outlive that, or the roster that comes back (it
    // lists the DM until the queued leave is heard) shows the DM's tools for a moment.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      asTheDM();
      const { rerender } = render(<App />);
      await confirmLeave();
      await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(false));

      await blip(rerender);
      asTheDM();
      await act(async () => {
        rerender(<App />);
      });
      expect(latestHeaderProps?.table?.isDM).toBe(false);

      // The leave is never heard: it is given up on, and the seat is the DM again.
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      await waitFor(() => expect(latestHeaderProps?.table?.isDM).toBe(true));
    } finally {
      vi.useRealTimers();
    }
  });

  it("still drops map-edit when the server says you are no longer a DM", async () => {
    // Start as a DM on purpose: the role mock outlives the test that set it.
    vi.mocked(useDMRole).mockReturnValue({ isDM: true, roleKnown: true, elevateToDM: vi.fn() });
    mockUseWebSocket.mockReturnValue({
      ...baseWebSocketState,
      authState: AuthState.AUTHENTICATED,
      snapshot: buildSnapshot(),
    });

    const { rerender } = render(<App />);
    await armMapEdit();

    // A real revocation: the snapshot is PRESENT and no longer lists this
    // client as a DM. Without this half the guard would be a no-op and the
    // soft-lock it exists for would be back.
    vi.mocked(useDMRole).mockReturnValue({
      isDM: false,
      roleKnown: true,
      elevateToDM: vi.fn(),
    });
    await act(async () => {
      rerender(<App />);
    });

    await waitFor(() => expect(latestMapBoardProps?.mapEditMode).toBe(false));
  });
});
