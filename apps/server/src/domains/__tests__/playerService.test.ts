import { describe, expect, it, beforeEach } from "vitest";
import { PlayerService } from "../player/service.js";
import { createEmptyRoomState } from "../room/model.js";

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

  it("manages status effects lifecycle", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");

    // Test applying status effects
    expect(service.setStatusEffects(state, "uid-1", ["poisoned", "blessed"])).toBe(true);
    let player = service.findPlayer(state, "uid-1");
    expect(player?.statusEffects).toEqual(["poisoned", "blessed"]);

    // Test replacing status effects
    expect(service.setStatusEffects(state, "uid-1", ["stunned"])).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.statusEffects).toEqual(["stunned"]);

    // Test clearing all status effects
    expect(service.setStatusEffects(state, "uid-1", [])).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.statusEffects).toEqual([]);

    // Test setting status effects on unknown player
    expect(service.setStatusEffects(state, "missing-uid", ["poisoned"])).toBe(false);
  });

  it("handles DM role transitions and permissions", () => {
    const state = createState();
    const player = service.createPlayer(state, "uid-1");

    // Test initial state - player is not a DM
    expect(player.isDM).toBe(false);

    // Test promoting player to DM
    expect(service.setDMMode(state, "uid-1", true)).toBe(true);
    let updatedPlayer = service.findPlayer(state, "uid-1");
    expect(updatedPlayer?.isDM).toBe(true);

    // Test demoting DM back to player
    expect(service.setDMMode(state, "uid-1", false)).toBe(true);
    updatedPlayer = service.findPlayer(state, "uid-1");
    expect(updatedPlayer?.isDM).toBe(false);

    // Test setting DM mode on unknown player
    expect(service.setDMMode(state, "missing-uid", true)).toBe(false);
  });

  it("handles portrait edge cases", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");

    // Test setting empty string as portrait
    expect(service.setPortrait(state, "uid-1", "")).toBe(true);
    let player = service.findPlayer(state, "uid-1");
    expect(player?.portrait).toBe("");

    // Test setting valid portrait URL
    expect(service.setPortrait(state, "uid-1", "https://example.com/portrait.jpg")).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.portrait).toBe("https://example.com/portrait.jpg");

    // Test setting malformed URL (service accepts any string)
    expect(service.setPortrait(state, "uid-1", "not-a-valid-url")).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.portrait).toBe("not-a-valid-url");

    // Test setting portrait with special characters
    expect(service.setPortrait(state, "uid-1", "data:image/png;base64,iVBORw0K")).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.portrait).toBe("data:image/png;base64,iVBORw0K");
  });

  it("handles player disconnection cleanup", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");
    service.createPlayer(state, "uid-2");

    // Test player count before removal
    expect(state.players).toHaveLength(2);

    // Test removing first player (simulating disconnection)
    expect(service.removePlayer(state, "uid-1")).toBe(true);
    expect(state.players).toHaveLength(1);
    expect(service.findPlayer(state, "uid-1")).toBeUndefined();
    expect(service.findPlayer(state, "uid-2")).toBeDefined();

    // Test removing already removed player
    expect(service.removePlayer(state, "uid-1")).toBe(false);
    expect(state.players).toHaveLength(1);

    // Test removing last player
    expect(service.removePlayer(state, "uid-2")).toBe(true);
    expect(state.players).toHaveLength(0);
  });

  it("restores player state across reconnection", () => {
    const state = createState();

    // Test that createPlayer returns existing player instead of creating duplicate
    const player1 = service.createPlayer(state, "uid-1");
    service.setPortrait(state, "uid-1", "portrait.jpg");
    service.rename(state, "uid-1", "Hero");
    service.setHP(state, "uid-1", 50, 100);
    service.setStatusEffects(state, "uid-1", ["blessed"]);

    expect(state.players).toHaveLength(1);

    // Test reconnection - createPlayer should return existing player
    const player2 = service.createPlayer(state, "uid-1");
    expect(state.players).toHaveLength(1);
    expect(player2).toBe(player1);
    expect(player2.name).toBe("Hero");
    expect(player2.portrait).toBe("portrait.jpg");
    expect(player2.hp).toBe(50);
    expect(player2.maxHp).toBe(100);
    expect(player2.statusEffects).toEqual(["blessed"]);
  });

  it("handles multiple player sessions edge cases", () => {
    const state = createState();

    // Test same UID reconnecting maintains single player instance
    const player1 = service.createPlayer(state, "uid-1");
    service.rename(state, "uid-1", "Warrior");

    const player2 = service.createPlayer(state, "uid-1");
    expect(state.players).toHaveLength(1);
    expect(player2.name).toBe("Warrior");
    expect(player1).toBe(player2);

    // Test multiple different players
    service.createPlayer(state, "uid-2");
    service.createPlayer(state, "uid-3");
    expect(state.players).toHaveLength(3);

    // Test that each player has unique sequential name
    expect(state.players[0].name).toBe("Warrior");
    expect(state.players[1].name).toBe("Player 2");
    expect(state.players[2].name).toBe("Player 3");
  });

  it("validates HP boundaries", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");

    // Test setting negative HP (service allows it, validation should happen at business logic level)
    expect(service.setHP(state, "uid-1", -10, 100)).toBe(true);
    let player = service.findPlayer(state, "uid-1");
    expect(player?.hp).toBe(-10);
    expect(player?.maxHp).toBe(100);

    // Test HP exceeding maxHP (service allows it, validation should happen at business logic level)
    expect(service.setHP(state, "uid-1", 150, 100)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.hp).toBe(150);
    expect(player?.maxHp).toBe(100);

    // Test zero HP
    expect(service.setHP(state, "uid-1", 0, 100)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.hp).toBe(0);

    // Test zero maxHP
    expect(service.setHP(state, "uid-1", 0, 0)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.hp).toBe(0);
    expect(player?.maxHp).toBe(0);

    // Test setting HP on unknown player
    expect(service.setHP(state, "missing-uid", 50, 100)).toBe(false);
  });

  it("manages player voice status", () => {
    const state = createState();
    service.createPlayer(state, "uid-1");

    // Test initial mic level is undefined
    let player = service.findPlayer(state, "uid-1");
    expect(player?.micLevel).toBeUndefined();

    // Test setting mic level to speaking state
    expect(service.setMicLevel(state, "uid-1", 0.8)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.micLevel).toBe(0.8);

    // Test muting (level 0)
    expect(service.setMicLevel(state, "uid-1", 0)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.micLevel).toBe(0);

    // Test max mic level
    expect(service.setMicLevel(state, "uid-1", 1.0)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.micLevel).toBe(1.0);

    // Test intermediate mic level
    expect(service.setMicLevel(state, "uid-1", 0.5)).toBe(true);
    player = service.findPlayer(state, "uid-1");
    expect(player?.micLevel).toBe(0.5);

    // Test setting mic level on unknown player
    expect(service.setMicLevel(state, "missing-uid", 0.5)).toBe(false);
  });
});
