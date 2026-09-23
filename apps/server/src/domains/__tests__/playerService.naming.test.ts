import { describe, expect, it } from "vitest";
import { PlayerService } from "../player/service.js";
import { createEmptyRoomState } from "../room/model.js";

describe("PlayerService generated names", () => {
  it("skips an occupied generated name after a non-tail removal without changing survivors", () => {
    const service = new PlayerService();
    const state = createEmptyRoomState();
    for (let i = 1; i <= 4; i++) service.createPlayer(state, `uid-${i}`);
    expect(service.removePlayer(state, "uid-2")).toBe(true);
    const survivors = [...state.players];
    const before = structuredClone(survivors);

    const newcomer = service.createPlayer(state, "uid-new");

    expect(newcomer.name).toBe("Player 5");
    expect(state.players.slice(0, 3)).toEqual(before);
    survivors.forEach((player, index) => expect(state.players[index]).toBe(player));
    expect(new Set(state.players.map((player) => player.name)).size).toBe(4);
  });

  it("skips consecutive collisions including names chosen manually", () => {
    const service = new PlayerService();
    const state = createEmptyRoomState();
    for (let i = 1; i <= 4; i++) service.createPlayer(state, `uid-${i}`);
    service.removePlayer(state, "uid-2");
    service.rename(state, "uid-1", "Player 5");
    service.rename(state, "uid-3", "Player 6");

    expect(service.createPlayer(state, "uid-new").name).toBe("Player 7");
    expect(state.players.map((player) => player.name)).toEqual([
      "Player 5",
      "Player 6",
      "Player 4",
      "Player 7",
    ]);
  });

  it("returns an existing UID's exact row even when its custom name is duplicated", () => {
    const service = new PlayerService();
    const state = createEmptyRoomState();
    const existing = service.createPlayer(state, "uid-1");
    service.createPlayer(state, "uid-2");
    service.rename(state, "uid-1", "Shared name");
    service.rename(state, "uid-2", "Shared name");
    service.setDMMode(state, "uid-1", true);
    service.setHP(state, "uid-1", 31, 60);
    const before = structuredClone(state.players);

    expect(service.createPlayer(state, "uid-1")).toBe(existing);
    expect(state.players).toEqual(before);
  });

  it("keeps custom duplicate names and does not impose uniqueness on rename", () => {
    const service = new PlayerService();
    const state = createEmptyRoomState();
    service.createPlayer(state, "uid-1");
    service.createPlayer(state, "uid-2");
    expect(service.rename(state, "uid-2", "Player 1")).toBe(true);

    expect(service.createPlayer(state, "uid-new").name).toBe("Player 3");
    expect(state.players.map((player) => player.name)).toEqual([
      "Player 1",
      "Player 1",
      "Player 3",
    ]);
  });

  it("starts at count plus one rather than the smallest gap or highest suffix", () => {
    const service = new PlayerService();
    const state = createEmptyRoomState();
    for (let i = 1; i <= 4; i++) service.createPlayer(state, `uid-${i}`);
    service.removePlayer(state, "uid-2");
    service.rename(state, "uid-4", "Player 10000");

    expect(service.createPlayer(state, "uid-new").name).toBe("Player 4");
  });

  it("allocates ordinary sequential names separately in each room", () => {
    const service = new PlayerService();
    const firstRoom = createEmptyRoomState();
    const secondRoom = createEmptyRoomState();
    expect(service.createPlayer(firstRoom, "uid-1").name).toBe("Player 1");
    expect(service.createPlayer(firstRoom, "uid-2").name).toBe("Player 2");
    expect(service.createPlayer(secondRoom, "uid-1").name).toBe("Player 1");
  });
});
