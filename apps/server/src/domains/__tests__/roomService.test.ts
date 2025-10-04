import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));

import { writeFileSync, readFileSync, existsSync } from "fs";
import { RoomService } from "../room/service.ts";

const createClient = () => ({
  readyState: 1,
  send: vi.fn(),
});

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
      pointers: [{ uid: "uid-1", x: 5, y: 5, timestamp: Date.now() }],
      drawings: [],
      gridSize: 32,
      diceRolls: [],
    });

    const merged = service.getState();
    expect(merged.players).toHaveLength(1);
    expect(merged.players[0]?.name).toBe("Saved Player");
    expect(merged.players[0]?.lastHeartbeat).toBe(123);
    expect(merged.tokens).toHaveLength(1);
  });

  it("broadcasts snapshots and prunes expired pointers", () => {
    const service = new RoomService();
    const state = service.getState();
    state.pointers.push({ uid: "uid-1", x: 0, y: 0, timestamp: Date.now() - 5000 });
    state.tokens.push({ id: "token-3", owner: "uid-3", x: 3, y: 4, color: "#f00" });

    const client = createClient();
    service.broadcast(new Set([client as any]));

    expect(client.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(client.send.mock.calls[0][0]);
    expect(payload.pointers).toHaveLength(0);
    expect(payload.tokens).toHaveLength(1);
    expect(writeFileSync).toHaveBeenCalledTimes(1);
  });
});
