import { describe, expect, it, beforeEach } from "vitest";
import { PlayerService } from "../player/service.ts";
import { createEmptyRoomState } from "../room/model.ts";

const createState = () => createEmptyRoomState();

describe("PlayerService", () => {
  let service: PlayerService;

  beforeEach(() => {
    service = new PlayerService();
  });

  it("creates players with sequential names and heartbeat", () => {
    const state = createState();
    const player1 = service.createPlayer(state, "uid-1");
    const player2 = service.createPlayer(state, "uid-2");

    expect(player1.name).toBe("Player 1");
    expect(player2.name).toBe("Player 2");
    expect(player1.lastHeartbeat).toBeTypeOf("number");
    expect(state.players).toHaveLength(2);
  });

  it("updates player portrait, name, mic level, and HP", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");

    expect(service.setPortrait(state, "uid-1", "portrait-data")).toBe(true);
    expect(service.rename(state, "uid-1", "Champion")).toBe(true);
    expect(service.setMicLevel(state, "uid-1", 0.5)).toBe(true);
    expect(service.setHP(state, "uid-1", 5, 10)).toBe(true);

    const updated = service.findPlayer(state, "uid-1");
    expect(updated?.portrait).toBe("portrait-data");
    expect(updated?.name).toBe("Champion");
    expect(updated?.micLevel).toBe(0.5);
    expect(updated?.hp).toBe(5);
    expect(updated?.maxHp).toBe(10);
  });

  it("ignores updates for unknown players and supports removal", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");

    expect(service.rename(state, "missing", "Name")).toBe(false);
    expect(service.removePlayer(state, "uid-1")).toBe(true);
    expect(state.players).toHaveLength(0);
  });
});
