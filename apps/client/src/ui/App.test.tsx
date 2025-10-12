import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import React from "react";
import { AuthState, ConnectionState } from "../services/websocket";
import { App } from "./App";

const mockUseWebSocket = vi.fn();

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: (options: unknown) => mockUseWebSocket(options),
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

vi.mock("../features/dm", () => ({
  DMMenu: vi.fn(() => <div data-testid="dm-menu">DM Menu</div>),
}));

vi.mock("../features/drawing/components", () => ({
  DrawingToolbar: vi.fn(() => <div data-testid="drawing-toolbar">Toolbar</div>),
}));

vi.mock("../components/layout/Header", () => ({
  Header: () => <div data-testid="header">Header</div>,
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
  default: () => <div data-testid="map-board">Map Board</div>,
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
};

describe("App", () => {
  beforeEach(() => {
    mockUseWebSocket.mockReset();
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
      tokens: [],
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
});
