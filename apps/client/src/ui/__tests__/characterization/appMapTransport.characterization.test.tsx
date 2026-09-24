import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMapDocument,
  type ClientMessage,
  type RoomSnapshot,
  type ServerMessage,
} from "@herobyte/shared";
import { AuthState, ConnectionState } from "../../../services/websocket";
import type { MainLayoutProps } from "../../../layouts/props/MainLayoutProps";
import { App } from "../../App";

const network = vi.hoisted(() => ({ useWebSocket: vi.fn() }));
let layout: MainLayoutProps;
vi.mock("../../../hooks/useWebSocket", () => ({ useWebSocket: network.useWebSocket }));
vi.mock("../../../layouts/MainLayout", () => ({
  MainLayout: (props: MainLayoutProps) => {
    layout = props;
    return null;
  },
}));
vi.mock("../../../layouts/MobileLayout", () => ({
  MobileLayout: (props: MainLayoutProps) => {
    layout = props;
    return null;
  },
}));
vi.mock("../../../utils/session", () => ({ getSessionUID: () => "transport-dm" }));
vi.mock("../../useVoiceChat", () => ({ useVoiceChat: vi.fn() }));
vi.mock("../../../hooks/useHeartbeat", () => ({ useHeartbeat: vi.fn() }));
vi.mock("../../../hooks/useMicrophone", () => ({
  useMicrophone: () => ({ micEnabled: false, micStream: null, toggleMic: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const send = vi.fn<(message: ClientMessage) => void>();
  let receive: (message: ServerMessage) => void = () => {
    throw new Error("No subscriber");
  };
  const snapshot: RoomSnapshot = {
    users: [],
    players: [{ uid: "transport-dm", name: "DM", hp: 10, maxHp: 10, isDM: true }],
    tokens: [],
    drawings: [],
    pointers: [],
    characters: [],
    diceRolls: [],
    gridSize: 50,
    gridSquareSize: 5,
    mapBackground: undefined,
  };
  const state = {
    snapshot,
    send,
    remoteMeasurements: [],
    connectionState: ConnectionState.CONNECTED,
    authState: AuthState.AUTHENTICATED,
    authError: null,
    isConnected: true,
    authenticate: vi.fn(),
    connect: vi.fn(),
    getAuthCredentials: () => ({ secret: "local-test" }),
    registerRtcHandler: vi.fn(),
    registerCommandDropHandler: vi.fn(),
    registerServerEventHandler: (handler: (message: ServerMessage) => void) => {
      receive = handler;
    },
  };
  network.useWebSocket.mockImplementation(() => state);
  const view = render(<App />);
  const document = createMapDocument({
    id: "app-map",
    name: "App map",
    width: 2000,
    height: 2000,
    timestamp: 1,
  });
  act(() => receive({ t: "map-studio-document", document }));
  return {
    ...view,
    send,
    state,
    document,
    receive: (message: ServerMessage) => act(() => receive(message)),
  };
}

describe("App map transport handoff before props extraction", () => {
  it("routes application replies and Generate through the controller handed to the layout", () => {
    const h = setup();
    expect(layout.mapStudio?.activeDocument).toEqual(h.document);
    act(() =>
      layout.mapStudio?.generate({
        recipe: "dungeon",
        seed: 42,
        bounds: { x: 0, y: 0, cols: 24, rows: 20 },
        params: { theme: "stone", density: "medium" },
      }),
    );
    const message = h.send.mock.calls
      .map(([value]) => value)
      .find((value) => value.t === "map-studio-generate");
    expect(message).toMatchObject({ documentId: "app-map", seed: 42 });
    if (message?.t !== "map-studio-generate") throw new Error("Generate was not sent");
    expect(layout.mapStudio?.saving).toBe(true);
    h.receive({
      t: "map-studio-document",
      document: { ...h.document, revision: 1 },
      appliedCommandId: message.commandId,
    });
    expect(layout.mapStudio?.saving).toBe(false);
    expect(layout.mapStudio?.activeDocument?.revision).toBe(1);
  });

  it("replays the exact pending message when the App connection recovers", () => {
    const h = setup();
    act(() =>
      layout.mapStudio?.generate({
        recipe: "dungeon",
        seed: 7,
        bounds: { x: 0, y: 0, cols: 24, rows: 20 },
        params: { theme: "stone", density: "medium" },
      }),
    );
    const first = h.send.mock.calls
      .map(([value]) => value)
      .find((value) => value.t === "map-studio-generate");
    h.state.isConnected = false;
    h.rerender(<App />);
    h.state.isConnected = true;
    h.rerender(<App />);
    const requests = h.send.mock.calls
      .map(([value]) => value)
      .filter((value) => value.t === "map-studio-generate");
    expect(requests).toHaveLength(2);
    expect(requests[1]).toBe(first);
  });
});
