// The movement budget's charge, on the roads a token position actually
// changes by: the transform-object road (a drag release, a keyboard step)
// and the legacy `move` road. Charged only in combat, only for a token that
// backs a character, under the table's rule and feet-per-square, with
// Pathfinder's alternation carried across hops.

import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { RoomService } from "../../service.js";

const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "movementCharge-state.json");

describe("movement budget charge", () => {
  let room: RoomService;
  const dm = "dm-uid";
  const player = "player-uid";

  beforeEach(() => {
    room = new RoomService({ stateFile: TEST_STATE_FILE });
    room.setState({
      players: [
        {
          uid: dm,
          name: "DM",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: 0,
          hp: 1,
          maxHp: 1,
          isDM: true,
          statusEffects: [],
        },
        {
          uid: player,
          name: "P",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: 0,
          hp: 1,
          maxHp: 1,
          isDM: false,
          statusEffects: [],
        },
      ],
      tokens: [
        { id: "tok-pc", owner: player, x: 3, y: 4, color: "#fff" },
        { id: "tok-free", owner: player, x: 8, y: 8, color: "#fff" },
      ],
      characters: [
        {
          id: "pc",
          type: "pc",
          name: "Fighter",
          hp: 10,
          maxHp: 10,
          tokenId: "tok-pc",
          ownedByPlayerUID: player,
        },
      ],
      combatActive: true,
      diagonalRule: "5e",
      gridSquareSize: 5,
    });
    room.createSnapshot(); // rebuilds the scene graph the transform road needs
  });

  const pc = () => room.getState().characters.find((c) => c.id === "pc")!;

  it("a transform-object step charges the token's character by the rule, and accumulates", () => {
    expect(
      room.applySceneObjectTransform("token:tok-pc", player, { position: { x: 4, y: 4 } }),
    ).toBe(true);
    expect(pc().movementUsed).toBe(5);
    expect(
      room.applySceneObjectTransform("token:tok-pc", player, { position: { x: 5, y: 5 } }),
    ).toBe(true);
    expect(pc()).toMatchObject({ movementUsed: 10, movementDiagonals: 1 });
  });

  it("charges nothing out of combat, and nothing for a token without a character", () => {
    room.getState().combatActive = false;
    room.applySceneObjectTransform("token:tok-pc", player, { position: { x: 9, y: 9 } });
    expect(pc().movementUsed).toBeUndefined();

    room.getState().combatActive = true;
    room.applySceneObjectTransform("token:tok-free", player, { position: { x: 9, y: 9 } });
    expect(room.getState().characters.every((c) => c.movementUsed === undefined)).toBe(true);
  });

  it("a refused move (not the owner) charges nothing", () => {
    expect(
      room.applySceneObjectTransform("token:tok-pc", "stranger", { position: { x: 4, y: 4 } }),
    ).toBe(false);
    expect(pc().movementUsed).toBeUndefined();
  });

  it("honours the table's diagonal rule and feet per square — Pathfinder alternates across hops", () => {
    const state = room.getState();
    state.diagonalRule = "pathfinder";
    state.gridSquareSize = 10;
    for (const step of [1, 2, 3, 4]) {
      room.applySceneObjectTransform("token:tok-pc", dm, {
        position: { x: 3 + step, y: 4 + step },
      });
    }
    // Diagonals cost 1, 2, 1, 2 squares at 10 ft each.
    expect(pc()).toMatchObject({ movementUsed: 60, movementDiagonals: 4 });
  });

  it("euclidean charges the straight line to one decimal", () => {
    room.getState().diagonalRule = "euclidean";
    room.applySceneObjectTransform("token:tok-pc", dm, { position: { x: 4, y: 5 } });
    expect(pc().movementUsed).toBe(7);
  });
});
