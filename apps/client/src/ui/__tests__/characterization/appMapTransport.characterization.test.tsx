import type { CommandDeliveryEvent } from "../../../services/websocket/serviceTypes";
import type { MapOperationHandle } from "../../../features/map-studio/mapOperation";
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
vi.mock("../../../hooks/useHeartbeat", () => ({ useHeartbeat: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  let delivery: ((event: CommandDeliveryEvent) => void) | undefined;
  const send = vi.fn<(message: ClientMessage) => void>((message) =>
    delivery?.({ type: "send-attempt", message }),
  );
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
    registerCommandDelivery: (handler: (event: CommandDeliveryEvent) => void) => {
      delivery = handler;
      return () => {
        if (delivery === handler) delivery = undefined;
      };
    },
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

describe("U3a App outcome and preview handoff", () => {
  it("connects transport observation to the same controller handed to the layout", async () => {
    const h = setup();
    let handle!: MapOperationHandle;
    act(() => {
      if (!layout.mapStudio) throw new Error("Missing App controller");
      handle = layout.mapStudio.generate({
        recipe: "dungeon",
        seed: 42,
        bounds: { x: 0, y: 0, cols: 24, rows: 20 },
        params: { theme: "stone", density: "medium" },
      });
    });
    const request = h.send.mock.calls
      .map(([message]) => message)
      .find((message) => message.t === "map-studio-generate");
    if (request?.t !== "map-studio-generate") throw new Error("No generation dispatched");
    h.receive({
      t: "map-studio-error",
      commandId: request.commandId,
      documentId: request.documentId,
      code: "command-not-applied",
      reason: "Walls locked",
    });
    await expect(handle.completion).resolves.toEqual({
      status: "failed",
      kind: "rejected",
      reason: "Walls locked",
    });
  });

  it("forwards the normalized aim but withholds it in Player View and after demotion", () => {
    const h = setup();
    h.state.snapshot = { ...h.state.snapshot, liveMapDocumentId: h.document.id };
    h.rerender(<App />);
    act(() => layout.setActiveTool("map-edit"));
    act(() => layout.mapEditToolbarProps.onSelectSubTool("generate"));
    act(() => layout.onMapEditRegionDragged({ x: 0, y: 0, width: 1200, height: 1000 }));
    expect(layout.mapEditPersistentPreview?.generateRegion).toMatchObject({
      documentId: h.document.id,
      cells: { x: 0, y: 0, cols: 24, rows: 20 },
    });
    act(() => layout.onTogglePlayerLens?.(true));
    expect(layout.mapEditPersistentPreview).toBeNull();
    act(() => layout.onTogglePlayerLens?.(false));
    expect(layout.mapEditPersistentPreview?.generateRegion).not.toBeNull();
    h.state.snapshot = {
      ...h.state.snapshot,
      players: h.state.snapshot.players.map((player) => ({ ...player, isDM: false })),
    };
    h.rerender(<App />);
    expect(layout.mapEditPersistentPreview?.generateRegion).toBeNull();
  });
});
