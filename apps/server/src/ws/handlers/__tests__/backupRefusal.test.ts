// A table backup that Restore would refuse is not handed over: the DM is told why, so
// they can clear absent seats, NPCs, drawings or maps and save again (the owner's rule,
// 2026-10-13). Past 100 seats the load check refuses the file whole; past the wire
// limit ws drops the frame before any handler sees it; a waiting scene the envelope
// would reject is left out of the file, so the file would restore without it.

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_RESTORE_MAX_BYTES,
  loadSessionFrameBytes,
  type MapDocument,
  type Player,
  type ServerMessage,
  type SessionFile,
} from "@herobyte/shared";
import { RoomService } from "../../../domains/room/service.js";
import { RoomMessageHandler } from "../RoomMessageHandler.js";
import type { AuthService } from "../../../domains/auth/service.js";
import type { MapStudioService } from "../../../domains/mapStudio/service.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "backupRefusal-state.json");
const seat = (uid: string, isDM = false) =>
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
const items = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }));
const waitingScene = (mapDocumentId: string, extra: Record<string, unknown>) => ({
  mapDocumentId,
  suspendedAt: 1,
  tokens: [],
  props: [],
  drawings: [],
  sceneObjects: [],
  characterLinks: {},
  doorStates: {},
  combatActive: false,
  initiatives: {},
  fogEnabled: false,
  defaultVisionRadius: null,
  ...extra,
});
type Refused = Extract<ServerMessage, { t: "session-export-refused" }>;
type Filed = Extract<ServerMessage, { t: "session-file" }>;

describe("Download table backup refuses a file Restore would refuse", () => {
  afterEach(() => vi.restoreAllMocks());

  const setup = (
    seats: number,
    extra: Record<string, unknown> = {},
    mapDocuments: MapDocument[] = [],
  ) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const roomService = new RoomService({ stateFile: STATE_FILE });
    roomService.setState({
      players: [seat("dm", true), ...Array.from({ length: seats - 1 }, (_, n) => seat(`p-${n}`))],
      users: ["dm"],
      ...extra,
    } as never);
    const sent: ServerMessage[] = [];
    const handler = new RoomMessageHandler(
      roomService,
      {} as AuthService,
      (_uid, message) => sent.push(message),
      () => "default",
      { list: () => mapDocuments } as unknown as MapStudioService,
    );
    handler.handleSessionExport(roomService.getState(), "dm", true);
    return sent;
  };
  const refusal = (sent: ServerMessage[]) => {
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ t: "session-export-refused" });
    return (sent[0] as Refused).reason;
  };

  it("hands over a table at 100 seats", () => {
    const sent = setup(100);
    expect(sent.map((message) => ("t" in message ? message.t : null))).toEqual(["session-file"]);
  });

  it("refuses a table at 101 seats in one sentence of what is over and one of what to do", () => {
    const reason = refusal(setup(101));
    expect(reason).toBe(
      "This table backup would not restore, so it was not saved. The table has 101 seats, and a backup holds 100. " +
        "Remove 1 or more absent players (DM Menu → Table → Players at this table, or on a phone ♛ DM → Table). " +
        "Then download it again.",
    );
  });

  it("refuses one byte past the restore limit and hands over a file exactly at it", () => {
    const padded = (n: number) => setup(2, { drawings: [{ id: "pad", note: "x".repeat(n) }] });
    const base = loadSessionFrameBytes((padded(0)[0] as Filed).file as SessionFile);
    const atLimit = padded(SESSION_RESTORE_MAX_BYTES - base);
    expect(atLimit[0]).toMatchObject({ t: "session-file" });
    expect(loadSessionFrameBytes((atLimit[0] as Filed).file as SessionFile)).toBe(
      SESSION_RESTORE_MAX_BYTES,
    );
    expect(refusal(padded(SESSION_RESTORE_MAX_BYTES - base + 1))).toMatch(
      /At 1,024 KB it is past the 1,023 KB one restore carries/,
    );
  });

  it("names maps alone when maps are the weight", () => {
    const heavy = { id: "heavy", name: "x".repeat(1024 * 1024 + 1) } as unknown as MapDocument;
    const reason = refusal(setup(2, {}, [heavy]));
    expect(reason).toMatch(/At 1,025 KB it is past the 1,023 KB one restore carries\./);
    expect(reason).toMatch(
      /The heaviest part is maps and their waiting scenes \(1,025 KB\)\. Delete maps you no longer need/,
    );
    expect(reason).not.toMatch(/drawings|tokens and characters/);
  });

  it("names drawings alone, not maps, when drawings are the weight", () => {
    const stroke = (n: number) => ({ id: `d-${n}`, type: "freehand", points: Array(4000).fill(1) });
    const reason = refusal(
      setup(2, { drawings: Array.from({ length: 140 }, (_, n) => stroke(n)) }),
    );
    expect(reason).toMatch(
      /The heaviest part is drawings \([\d,]+ KB\)\. Erase drawings with Clear All Drawings/,
    );
    expect(reason).not.toMatch(/maps and their waiting scenes|tokens and characters/);
  });

  it("says each collection over its limit once, and the combined count only when still over", () => {
    // 1,001 tokens: one over. Scene objects 5,001 = the same token, said once.
    const once = refusal(setup(2, { tokens: items(1001, "t"), sceneObjects: items(5001, "o") }));
    expect(once).toMatch(
      /The table has 1,001 tokens, and a backup holds 1,000\. Delete 1 or more tokens or NPCs\./,
    );
    expect(once).not.toMatch(/together/);

    // 50 drawings over, but 5,100 scene objects: still 50 over once those go.
    const both = refusal(setup(2, { drawings: items(5050, "d"), sceneObjects: items(5100, "o") }));
    expect(both).toMatch(
      /The table has 5,050 drawings, and a backup holds 5,000\. Erase 50 or more/,
    );
    expect(both).toMatch(
      /The table has 5,100 tokens, drawings and props together, and a backup holds 5,000\. Erase drawings or delete tokens or props, 100 or more in all\./,
    );
    expect(both.match(/Then download it again/g)).toHaveLength(1);
  });

  it("refuses when a waiting scene would be left out, names its map, and says each cause once", () => {
    const cellar = { id: "cellar", name: "The Cellar" } as unknown as MapDocument;
    const scene = waitingScene("cellar", {
      drawings: items(5001, "d"),
      sceneObjects: items(5001, "o"),
    });
    const reason = refusal(setup(2, { sceneStates: { cellar: scene } }, [cellar]));
    expect(reason).toMatch(
      /The scene waiting on the map "The Cellar" would be left out: it has 5,001 drawings \(a backup holds 5,000\)\. Open that map with Use at table/,
    );
    expect(reason).not.toMatch(/together/);
  });

  it("calls a waiting scene whose map is gone a fault", () => {
    const scene = waitingScene("gone", { tokens: items(1001, "t") });
    const reason = refusal(setup(2, { sceneStates: { gone: scene } }));
    expect(reason).toMatch(
      /A scene waiting on a map that no longer exists would be left out; this is a fault/,
    );
  });

  it("names a stored map that fails the restore's check, and says to delete it", () => {
    const broken = { id: "bad", name: "Broken map" } as unknown as MapDocument;
    const reason = refusal(setup(2, {}, [broken]));
    expect(reason).toMatch(
      /The map "Broken map" does not pass the restore's check\. Delete it \(DM Menu → Maps/,
    );
  });

  it("calls a malformed table a fault, not something to clear", () => {
    const reason = refusal(setup(2, { tokens: [5] }));
    expect(reason).toMatch(/does not pass the restore's check/);
    expect(reason).toMatch(/This is a fault, not something to clear/);
    expect(reason).not.toMatch(/Then download it again/);
  });
});
