// A restored backup's monsters, parked on a map the table had left, may name a uid
// that is a player tonight. The restore installs parked maps after the snapshot's
// rehome, so it rehomes them again (dmDemotion.ts); otherwise that player would see
// through them on the table's travel back.

import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Player, RoomSnapshot, SceneState } from "@herobyte/shared";
import { RoomService } from "../../../domains/room/service.js";
import { RoomMessageHandler } from "../RoomMessageHandler.js";
import type { AuthService } from "../../../domains/auth/service.js";
import type { MapStudioService } from "../../../domains/mapStudio/service.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "loadSessionRehome-state.json");
const seat = (uid: string, isDM: boolean) =>
  ({
    uid,
    name: uid,
    portrait: "",
    micLevel: 0,
    lastHeartbeat: 0,
    hp: 1,
    maxHp: 1,
    isDM,
  }) as Player;

describe("load-session rehomes the parked maps' monsters", () => {
  it("passes a parked goblin owned by tonight's player to the DM who restored", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const roomService = new RoomService({ stateFile: STATE_FILE });
    roomService.setState({
      players: [seat("dm-now", true), seat("old-dm", false)],
      users: ["dm-now", "old-dm"],
    });
    const studio = {
      list: () => [{ id: "cave" }],
      get: () => ({ id: "cave" }),
      restore: () => undefined,
    } as unknown as MapStudioService;
    const handler = new RoomMessageHandler(
      roomService,
      {} as AuthService,
      () => undefined,
      () => "default",
      studio,
    );
    const snapshot = {
      users: [],
      players: [seat("dm-now", true), seat("old-dm", false)],
      characters: [{ id: "goblin", name: "Goblin", type: "npc", hp: 7, maxHp: 7, tokenId: null }],
      tokens: [],
      props: [],
      pointers: [],
      drawings: [],
      gridSize: 50,
      gridSquareSize: 5,
      diceRolls: [],
      sceneObjects: [],
      combatActive: false,
    } as unknown as RoomSnapshot;
    const parked = {
      mapDocumentId: "cave",
      suspendedAt: 1,
      tokens: [{ id: "t-goblin", owner: "old-dm", x: 0, y: 0, color: "#123456" }],
      props: [],
      drawings: [],
      sceneObjects: [],
      characterLinks: { "t-goblin": "goblin" },
      doorStates: {},
    } as unknown as SceneState;

    handler.handleLoadSession(roomService.getState(), "dm-now", snapshot, true, [], undefined, [
      parked,
    ]);

    expect(roomService.getState().sceneStates.cave?.tokens[0]?.owner).toBe("dm-now");
    vi.restoreAllMocks();
  });
});
