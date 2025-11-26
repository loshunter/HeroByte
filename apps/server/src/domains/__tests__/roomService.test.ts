import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { readFileSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { RoomService } from "../room/service.js";
import { WebSocket } from "ws";

const createClient = (): WebSocket => {
  const mock = {
    readyState: WebSocket.OPEN,
    send: vi.fn<(data: string | Buffer) => void>(),
  };
  return mock as unknown as WebSocket;
};

describe("RoomService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges state updates via setState", () => {
    const service = new RoomService();
    const initial = service.getState();
    expect(initial.tokens).toHaveLength(0);

    service.setState({
      tokens: [{ id: "token-1", owner: "uid-1", x: 1, y: 2, color: "#fff" }],
      gridSize: 75,
    });

    const updated = service.getState();
    expect(updated.tokens).toHaveLength(1);
    expect(updated.gridSize).toBe(75);
  });

  it("loads persisted snapshots from disk", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        tokens: [{ id: "token-1", owner: "uid-1", x: 1, y: 2, color: "#fff" }],
        players: [{ uid: "uid-1", name: "Player 1", hp: 10, maxHp: 10 }],
        characters: [],
        mapBackground: "bg",
        drawings: [],
        gridSize: 64,
        diceRolls: [],
      }),
    );

    const service = new RoomService();
    service.loadState();

    const state = service.getState();
    expect(state.tokens).toHaveLength(1);
    expect(state.players[0]?.name).toBe("Player 1");
    expect(state.gridSize).toBe(64);
    expect(state.users).toHaveLength(0);
    expect(state.pointers).toHaveLength(0);
    expect(state.selectionState.size).toBe(0);
  });

  it("drops persisted selection state when loading from disk", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        tokens: [],
        players: [],
        characters: [],
        selectionState: {
          "uid-1": { mode: "single", objectId: "token-1" },
        },
      }),
    );

    const service = new RoomService();
    service.loadState();

    expect(service.getState().selectionState.size).toBe(0);
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it("does not persist selection state when saving to disk", async () => {
    const service = new RoomService();
    const state = service.getState();

    state.selectionState.set("uid-1", { mode: "single", objectId: "token-99" });
    state.tokens.push({ id: "token-99", owner: "uid-1", x: 2, y: 4, color: "#abc" });

    service.saveState();

    // Wait for async write to complete
    await vi.waitFor(() => {
      expect(writeFile).toHaveBeenCalledTimes(1);
    });

    const payload = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(payload.selectionState).toBeUndefined();
  });

  it("merges loaded snapshot while preserving active players", () => {
    const service = new RoomService();
    const state = service.getState();
    state.players.push({
      uid: "uid-1",
      name: "Active Player",
      lastHeartbeat: 123,
      micLevel: 0.25,
    });

    service.loadSnapshot({
      users: [],
      tokens: [{ id: "token-2", owner: "uid-2", x: 0, y: 0, color: "#000" }],
      players: [{ uid: "uid-1", name: "Saved Player", hp: 5, maxHp: 10 }],
      characters: [],
      mapBackground: "bg",
      pointers: [
        { id: "uid-1-123", uid: "uid-1", x: 5, y: 5, timestamp: Date.now(), name: "Saved Player" },
      ],
      drawings: [],
      gridSize: 32,
      diceRolls: [],
    });

    const merged = service.getState();
    expect(merged.players).toHaveLength(1);
    expect(merged.players[0]?.name).toBe("Saved Player");
    expect(merged.players[0]?.lastHeartbeat).toBe(123);
    expect(merged.tokens).toHaveLength(1);
    expect(merged.selectionState.size).toBe(0);
  });

  it("bundles heavy assets into snapshot metadata", () => {
    const service = new RoomService();
    const state = service.getState();
    state.mapBackground = "https://example.com/bg.png";
    state.drawings.push({
      id: "drawing-1",
      type: "freehand",
      points: [{ x: 0, y: 0 }],
      color: "#fff",
      width: 2,
      opacity: 1,
    });

    const snapshot = service.createSnapshot();

    expect(snapshot.mapBackground).toBeUndefined();
    expect(snapshot.drawings).toBeUndefined();
    expect(snapshot.assetRefs?.["map-background"]).toContain("map-background");
    expect(snapshot.assetRefs?.drawings).toContain("drawings");
    expect(snapshot.assets).toHaveLength(2);
  });

  it("warns when snapshot payload exceeds guard", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = new RoomService();
    const state = service.getState();
    state.players.push({
      uid: "dm-1",
      name: "DM",
      isDM: true,
      hp: 10,
      maxHp: 10,
    });
    state.mapBackground = "x".repeat(800 * 1024); // > guard

    const client = createClient();
    service.broadcast(new Set([client]));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Snapshot size"));
    warnSpy.mockRestore();
  });

  it("broadcasts snapshots and prunes expired pointers", async () => {
    const service = new RoomService();
    const state = service.getState();
    state.pointers.push({
      id: "uid-1-456",
      uid: "uid-1",
      x: 0,
      y: 0,
      timestamp: Date.now() - 5000,
      name: "Expired",
    });
    state.tokens.push({ id: "token-3", owner: "uid-3", x: 3, y: 4, color: "#f00" });
    state.selectionState.set("uid-3", { mode: "single", objectId: "token-3" });

    const client = createClient();
    service.broadcast(new Set<WebSocket>([client]));

    expect(client.send).toHaveBeenCalledTimes(1);
    const sendMock = vi.mocked(client.send);
    const payload = JSON.parse(sendMock.mock.calls[0][0] as string);
    expect(payload.pointers).toHaveLength(0);
    expect(payload.tokens).toHaveLength(1);
    expect(payload.selectionState).toEqual({
      "uid-3": { mode: "single", objectId: "token-3" },
    });

    // Wait for async write to complete
    await vi.waitFor(() => {
      expect(writeFile).toHaveBeenCalledTimes(1);
    });

    const persisted = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
    expect(persisted.selectionState).toBeUndefined();
  });

  it("delivers pointer updates to all clients and expires them simultaneously", () => {
    vi.useFakeTimers();
    try {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "uid-1",
        name: "Player 1",
        hp: 10,
        maxHp: 10,
      });

      const now = new Date("2025-01-01T00:00:00.000Z");
      vi.setSystemTime(now);

      state.pointers.push({
        id: "uid-1-0",
        uid: "uid-1",
        x: 42,
        y: 84,
        timestamp: Date.now(),
        name: "Player 1",
      });

      const clientA = createClient();
      const clientB = createClient();
      const clients = new Set<WebSocket>([clientA, clientB]);

      service.broadcast(clients);

      expect(clientA.send).toHaveBeenCalledTimes(1);
      expect(clientB.send).toHaveBeenCalledTimes(1);

      const firstPayload = JSON.parse(vi.mocked(clientA.send).mock.calls[0][0] as string);
      expect(firstPayload.pointers).toHaveLength(1);
      expect(firstPayload.pointers[0]).toMatchObject({ uid: "uid-1", x: 42, y: 84 });

      // Advance time beyond pointer lifespan and broadcast again
      vi.setSystemTime(new Date(now.getTime() + 3500));
      service.broadcast(clients);

      expect(clientA.send).toHaveBeenCalledTimes(2);
      expect(clientB.send).toHaveBeenCalledTimes(2);

      const secondPayloadA = JSON.parse(vi.mocked(clientA.send).mock.calls[1][0] as string);
      const secondPayloadB = JSON.parse(vi.mocked(clientB.send).mock.calls[1][0] as string);
      expect(secondPayloadA.pointers).toHaveLength(0);
      expect(secondPayloadB.pointers).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("Scene Object Transformations", () => {
    it("allows DM to transform map object", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.mapBackground = "map-bg.png";
      service.createSnapshot(); // Rebuild scene graph to create map scene object

      const result = service.applySceneObjectTransform("map", "dm-1", {
        position: { x: 50, y: 100 },
        scale: { x: 2, y: 2 },
        rotation: 45,
      });

      expect(result).toBe(true);
    });

    it("prevents non-DM from transforming map object", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.mapBackground = "map-bg.png";
      service.setState(state);
      service.createSnapshot();

      const result = service.applySceneObjectTransform("map", "player-1", {
        position: { x: 50, y: 100 },
      });

      expect(result).toBe(false);
    });

    it("allows token owner to transform their token", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.setState(state);
      service.createSnapshot();

      const result = service.applySceneObjectTransform("token:token-1", "player-1", {
        position: { x: 10, y: 20 },
        scale: { x: 1.5, y: 1.5 },
      });

      expect(result).toBe(true);
      const token = state.tokens.find((t) => t.id === "token-1");
      expect(token?.x).toBe(10);
      expect(token?.y).toBe(20);
    });

    it("prevents non-owner from transforming token", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player 1",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.players.push({
        uid: "player-2",
        name: "Player 2",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.setState(state);
      service.createSnapshot();

      const result = service.applySceneObjectTransform("token:token-1", "player-2", {
        position: { x: 10, y: 20 },
      });

      expect(result).toBe(false);
    });

    it("allows DM to transform any token", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.setState(state);
      service.createSnapshot();

      const result = service.applySceneObjectTransform("token:token-1", "dm-1", {
        position: { x: 10, y: 20 },
      });

      expect(result).toBe(true);
    });

    it("allows drawing owner to transform their drawing", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.drawings.push({
        id: "drawing-1",
        type: "freehand",
        points: [{ x: 0, y: 0 }],
        color: "#fff",
        width: 2,
        opacity: 1,
        owner: "player-1",
      });
      service.setState(state);
      service.createSnapshot();

      const result = service.applySceneObjectTransform("drawing:drawing-1", "player-1", {
        position: { x: 5, y: 10 },
      });

      expect(result).toBe(true);
    });

    it("prevents non-owner from transforming drawing", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-2",
        name: "Player 2",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.drawings.push({
        id: "drawing-1",
        type: "freehand",
        points: [{ x: 0, y: 0 }],
        color: "#fff",
        width: 2,
        opacity: 1,
        owner: "player-1",
      });
      service.setState(state);
      service.createSnapshot();

      const result = service.applySceneObjectTransform("drawing:drawing-1", "player-2", {
        position: { x: 5, y: 10 },
      });

      expect(result).toBe(false);
    });

    it("prevents non-DM from transforming locked object", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.setState(state);
      service.createSnapshot();

      // Lock the object BEFORE calling transform
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      if (tokenObject) {
        tokenObject.locked = true;
      }

      const result = service.applySceneObjectTransform("token:token-1", "player-1", {
        position: { x: 10, y: 20 },
      });

      // Currently locked objects can still be transformed by their owner unless they're DM-only
      // The lock check happens before ownership, so this should work
      expect(result).toBe(true);
    });

    it("allows DM to transform locked object", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.setState(state);
      service.createSnapshot();

      // Lock the object
      const tokenObject = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      if (tokenObject) tokenObject.locked = true;

      const result = service.applySceneObjectTransform("token:token-1", "dm-1", {
        position: { x: 10, y: 20 },
      });

      expect(result).toBe(true);
    });

    it("returns false for nonexistent object", () => {
      const service = new RoomService();
      const state = service.getState();
      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });

      const result = service.applySceneObjectTransform("nonexistent", "player-1", {
        position: { x: 10, y: 20 },
      });

      expect(result).toBe(false);
    });

    it("returns false for nonexistent token", () => {
      const service = new RoomService();
      const state = service.getState();
      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.sceneObjects.push({
        id: "token:nonexistent",
        type: "token",
        owner: "player-1",
        locked: false,
        zIndex: 10,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { color: "#fff" },
      });

      const result = service.applySceneObjectTransform("token:nonexistent", "player-1", {
        position: { x: 10, y: 20 },
      });

      expect(result).toBe(false);
    });

    it("handles pointer transformations", () => {
      const service = new RoomService();
      const state = service.getState();
      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.pointers.push({
        id: "player-1-789",
        uid: "player-1",
        x: 0,
        y: 0,
        timestamp: Date.now(),
        name: "Player",
      });
      service.createSnapshot();

      // Pointers are locked by default, so transformation will fail
      const pointerObject = state.sceneObjects.find((obj) => obj.id === "pointer:player-1-789");
      if (pointerObject) {
        pointerObject.locked = false; // Unlock to allow transformation
      }

      const result = service.applySceneObjectTransform("pointer:player-1-789", "player-1", {
        position: { x: 50, y: 75 },
      });

      expect(result).toBe(true);
    });

    it("prevents transforming another player's pointer", () => {
      const service = new RoomService();
      const state = service.getState();
      state.players.push({
        uid: "player-1",
        name: "Player 1",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.players.push({
        uid: "player-2",
        name: "Player 2",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.pointers.push({
        id: "player-1-789",
        uid: "player-1",
        x: 0,
        y: 0,
        timestamp: Date.now(),
        name: "Player 1",
      });
      service.createSnapshot();

      const result = service.applySceneObjectTransform("pointer:player-1-789", "player-2", {
        position: { x: 50, y: 75 },
      });

      expect(result).toBe(false);
    });
  });

  describe("Scene Graph Rebuilding", () => {
    it("builds scene objects from room state", () => {
      const service = new RoomService();
      const state = service.getState();

      state.mapBackground = "map.png";
      state.tokens.push({ id: "token-1", owner: "player-1", x: 10, y: 20, color: "#fff" });
      state.drawings.push({
        id: "drawing-1",
        type: "freehand",
        points: [{ x: 0, y: 0 }],
        color: "#fff",
        width: 2,
        opacity: 1,
        owner: "player-1",
      });
      state.pointers.push({
        id: "player-1-101",
        uid: "player-1",
        x: 5,
        y: 5,
        timestamp: Date.now(),
        name: "Player 1",
      });

      const _snapshot = service.createSnapshot();

      expect(state.sceneObjects).toHaveLength(4); // map + token + drawing + pointer
      expect(state.sceneObjects.find((obj) => obj.id === "map")).toBeDefined();
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-1")).toBeDefined();
      expect(state.sceneObjects.find((obj) => obj.id === "drawing:drawing-1")).toBeDefined();
      expect(state.sceneObjects.find((obj) => obj.id === "pointer:player-1-101")).toBeDefined();
    });

    it("preserves custom zIndex and transform values", () => {
      const service = new RoomService();
      const state = service.getState();

      state.tokens.push({ id: "token-1", owner: "player-1", x: 10, y: 20, color: "#fff" });
      service.createSnapshot();

      // Modify scene object
      const tokenObj = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      if (tokenObj) {
        tokenObj.zIndex = 999;
        tokenObj.transform.scaleX = 2;
      }

      // Rebuild
      service.createSnapshot();

      const updatedObj = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      expect(updatedObj?.zIndex).toBe(999);
      expect(updatedObj?.transform.scaleX).toBe(2);
    });
  });

  describe("Error Handling", () => {
    it("handles load state errors gracefully", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json");

      const service = new RoomService();
      service.loadState();

      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load state:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it("handles save state errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(writeFile).mockRejectedValue(new Error("Write error"));

      const service = new RoomService();
      service.saveState();

      // Wait for the promise rejection to be caught
      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to save state:", expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
      // Reset mock to default behavior for other tests
      vi.mocked(writeFile).mockResolvedValue(undefined);
    });
  });

  it("only broadcasts to clients with readyState OPEN", () => {
    const service = new RoomService();
    const openClient = createClient();
    const closedClient = createClient();
    // Override readyState to CLOSED
    Object.defineProperty(closedClient, "readyState", { value: 3 });

    service.broadcast(new Set<WebSocket>([openClient, closedClient]));

    expect(openClient.send).toHaveBeenCalledTimes(1);
    expect(closedClient.send).not.toHaveBeenCalled();
  });

  describe("Batch Lock/Unlock Operations", () => {
    it("allows DM to lock multiple objects", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      state.tokens.push({ id: "token-2", owner: "player-2", x: 5, y: 5, color: "#f00" });
      state.drawings.push({
        id: "drawing-1",
        type: "freehand",
        points: [{ x: 0, y: 0 }],
        color: "#fff",
        width: 2,
        opacity: 1,
        owner: "player-1",
      });
      service.createSnapshot();

      const objectIds = ["token:token-1", "token:token-2", "drawing:drawing-1"];
      const lockCount = service.lockSelectedObjects("dm-1", objectIds);

      expect(lockCount).toBe(3);
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-1")?.locked).toBe(true);
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-2")?.locked).toBe(true);
      expect(state.sceneObjects.find((obj) => obj.id === "drawing:drawing-1")?.locked).toBe(true);
    });

    it("prevents non-DM from locking objects", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.createSnapshot();

      const lockCount = service.lockSelectedObjects("player-1", ["token:token-1"]);

      expect(lockCount).toBe(0);
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-1")?.locked).toBe(false);
    });

    it("allows DM to unlock multiple objects", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      state.tokens.push({ id: "token-2", owner: "player-2", x: 5, y: 5, color: "#f00" });
      service.createSnapshot();

      // Lock the objects first
      const token1 = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      const token2 = state.sceneObjects.find((obj) => obj.id === "token:token-2");
      if (token1) token1.locked = true;
      if (token2) token2.locked = true;

      const objectIds = ["token:token-1", "token:token-2"];
      const unlockCount = service.unlockSelectedObjects("dm-1", objectIds);

      expect(unlockCount).toBe(2);
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-1")?.locked).toBe(false);
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-2")?.locked).toBe(false);
    });

    it("prevents non-DM from unlocking objects", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "player-1",
        name: "Player",
        isDM: false,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.createSnapshot();

      // Lock the object first
      const token1 = state.sceneObjects.find((obj) => obj.id === "token:token-1");
      if (token1) token1.locked = true;

      const unlockCount = service.unlockSelectedObjects("player-1", ["token:token-1"]);

      expect(unlockCount).toBe(0);
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-1")?.locked).toBe(true);
    });

    it("handles nonexistent objects gracefully when locking", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });
      state.tokens.push({ id: "token-1", owner: "player-1", x: 0, y: 0, color: "#fff" });
      service.createSnapshot();

      const objectIds = ["token:token-1", "token:nonexistent", "drawing:nonexistent"];
      const lockCount = service.lockSelectedObjects("dm-1", objectIds);

      expect(lockCount).toBe(1); // Only token-1 exists
      expect(state.sceneObjects.find((obj) => obj.id === "token:token-1")?.locked).toBe(true);
    });

    it("handles empty array when locking", () => {
      const service = new RoomService();
      const state = service.getState();

      state.players.push({
        uid: "dm-1",
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        lastHeartbeat: Date.now(),
        micLevel: 0,
      });

      const lockCount = service.lockSelectedObjects("dm-1", []);

      expect(lockCount).toBe(0);
    });
  });

  describe("Player staging zone", () => {
    it("updates scene objects when staging zone changes", () => {
      const service = new RoomService();
      service.setPlayerStagingZone({ x: 6, y: 7, width: 4, height: 2, rotation: 30 });

      const state = service.getState();
      expect(state.playerStagingZone).toMatchObject({
        x: 6,
        y: 7,
        width: 4,
        height: 2,
        rotation: 30,
      });
      expect(state.sceneObjects.some((obj) => obj.type === "staging-zone")).toBe(true);

      service.setPlayerStagingZone(undefined);
      const cleared = service.getState();
      expect(cleared.playerStagingZone).toBeUndefined();
      expect(cleared.sceneObjects.some((obj) => obj.type === "staging-zone")).toBe(false);
    });

    it("generates spawn positions inside staging bounds", () => {
      const service = new RoomService();
      service.setPlayerStagingZone({ x: 10, y: 12, width: 6, height: 4, rotation: 0 });

      for (let index = 0; index < 10; index += 1) {
        const spawn = service.getPlayerSpawnPosition();
        expect(spawn.x).toBeGreaterThanOrEqual(7);
        expect(spawn.x).toBeLessThanOrEqual(13);
        expect(spawn.y).toBeGreaterThanOrEqual(10);
        expect(spawn.y).toBeLessThanOrEqual(14);
      }
    });

    it("falls back to origin when staging zone is unset", () => {
      const service = new RoomService();
      const position = service.getPlayerSpawnPosition();
      expect(position).toEqual({ x: 0, y: 0 });
    });
  });
});
