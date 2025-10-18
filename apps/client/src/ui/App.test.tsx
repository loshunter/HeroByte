import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import React from "react";
import { AuthState, ConnectionState } from "../services/websocket";
import { App } from "./App";

const mockUseWebSocket = vi.fn();
const mockUseObjectSelection = vi.fn();
let latestHeaderProps: { onToolSelect: (mode: string | null) => void } | null = null;
let latestMapBoardProps: Record<string, unknown> | null = null;
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

vi.mock("../hooks/useDMRole", () => ({
  useDMRole: vi.fn(() => ({
    isDM: true,
    toggleDM: vi.fn(),
  })),
}));

let latestDMMenuProps: Record<string, unknown> | null = null;

vi.mock("../features/dm", () => ({
  DMMenu: (props: Record<string, unknown>) => {
    latestDMMenuProps = props;
    return <div data-testid="dm-menu">DM Menu</div>;
  },
}));

vi.mock("../features/drawing/components", () => ({
  DrawingToolbar: vi.fn(() => <div data-testid="drawing-toolbar">Toolbar</div>),
}));

vi.mock("../components/layout/Header", () => ({
  Header: (props: { onToolSelect: (mode: string | null) => void }) => {
    latestHeaderProps = props;
    return <div data-testid="header">Header</div>;
  },
}));

vi.mock("../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: () => <div data-testid="entities-panel">Entities</div>,
}));

vi.mock("../components/layout/ServerStatus", () => ({
  ServerStatus: () => <div data-testid="server-status">Status</div>,
}));

vi.mock("../components/dice/DiceRoller", () => ({
  DiceRoller: () => <div data-testid="dice-roller">Dice Roller</div>,
}));

vi.mock("../components/dice/RollLog", () => ({
  RollLog: () => <div data-testid="roll-log">Roll Log</div>,
}));

vi.mock("../utils/session", () => ({
  getSessionUID: () => "test-uid",
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

  it("renders the auth gate when the user is not authenticated", () => {
    mockUseWebSocket.mockReturnValue({ ...baseWebSocketState });

    render(<App />);

    expect(screen.getByText(/Join Your Room/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Room password/i)).toBeInTheDocument();
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
    expect(screen.getByTestId("server-status")).toBeInTheDocument();
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

  it("clears selection when transform mode is toggled off", async () => {
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

    const snapshot = {
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
        },
      ],
      characters: [],
      sceneObjects: [],
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
    });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId("dm-menu")).toBeInTheDocument());
    await waitFor(() => expect(latestHeaderProps).not.toBeNull());

    deselect.mockClear(); // Ignore initial clear on mount

    await act(async () => {
      latestHeaderProps!.onToolSelect("transform");
    });

    expect(deselect).not.toHaveBeenCalled();

    await act(async () => {
      latestHeaderProps!.onToolSelect(null);
    });

    await waitFor(() => expect(deselect).toHaveBeenCalledTimes(1));
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

    const onSetRoomPassword = latestDMMenuProps?.onSetRoomPassword as ((secret: string) => void) | undefined;
    expect(onSetRoomPassword).toBeDefined();

    await act(async () => {
      onSetRoomPassword?.("Secret123");
    });
    expect(send).toHaveBeenCalledWith({ t: "set-room-password", secret: "Secret123" });
  });
});
