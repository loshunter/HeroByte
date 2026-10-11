// A backup is held to the table's 500 characters on its own, but a restore keeps every
// seated player's live characters beside the file's (mergeCharacters). A file at 500
// and one seat of five would leave a table of 505, whose next backup fails its own load
// check. The restore is refused whole, before anything changes, and the DM is told.

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Player, RoomSnapshot, ServerMessage } from "@herobyte/shared";
import { RoomService } from "../../../domains/room/service.js";
import { RoomMessageHandler } from "../RoomMessageHandler.js";
import type { AuthService } from "../../../domains/auth/service.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "loadSessionCharacterLimit-state.json");
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
const character = (id: string, owner?: string) => ({
  id,
  name: id,
  type: owner ? "pc" : "npc",
  hp: 1,
  maxHp: 1,
  tokenId: null,
  ...(owner ? { ownedByPlayerUID: owner } : {}),
});
const fileWith = (count: number) =>
  ({
    users: [],
    players: [],
    characters: Array.from({ length: count }, (_, n) => character(`file-${n}`)),
    tokens: [],
    props: [],
    pointers: [],
    drawings: [],
    gridSize: 50,
    gridSquareSize: 5,
    diceRolls: [],
    sceneObjects: [],
    combatActive: false,
  }) as unknown as RoomSnapshot;

describe("load-session and the table's character limit", () => {
  afterEach(() => vi.restoreAllMocks());

  const setup = () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const roomService = new RoomService({ stateFile: STATE_FILE });
    roomService.setState({
      players: [seat("dm", true), seat("hero", false)],
      users: ["dm", "hero"],
      characters: Array.from({ length: 5 }, (_, n) => character(`hero-${n}`, "hero")),
    } as never);
    const sent: ServerMessage[] = [];
    const handler = new RoomMessageHandler(
      roomService,
      {} as AuthService,
      (_uid, message) => sent.push(message),
      () => "default",
    );
    return { roomService, handler, sent };
  };

  it("refuses a file that, with the seats' own characters, passes 500 — and says so", () => {
    const { roomService, handler, sent } = setup();
    expect(() =>
      handler.handleLoadSession(roomService.getState(), "dm", fileWith(496), true),
    ).toThrow(/501 characters — the maximum is 500/);
    expect(sent).toEqual([
      { t: "session-load-refused", reason: expect.stringMatching(/501 characters/) },
    ]);
    expect(roomService.getState().characters.map((c) => c.id)).toEqual([
      "hero-0",
      "hero-1",
      "hero-2",
      "hero-3",
      "hero-4",
    ]);
  });

  it("loads a file that leaves the table at exactly 500", () => {
    const { roomService, handler, sent } = setup();
    handler.handleLoadSession(roomService.getState(), "dm", fileWith(495), true);
    expect(sent).toEqual([]);
    expect(roomService.getState().characters).toHaveLength(500);
  });
});
