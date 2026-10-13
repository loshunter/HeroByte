// A table backup that Restore would refuse is not handed over: the DM is told why, so
// they can clear absent seats, NPCs, drawings or maps and save again (the owner's rule,
// 2026-10-13). Past 100 seats the load check refuses the file whole; past the wire
// limit ws drops the frame before any handler sees it; a waiting scene the envelope
// would reject is left out of the file, so the file would restore without it.

import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapDocument, Player, ServerMessage } from "@herobyte/shared";
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
type Refused = Extract<ServerMessage, { t: "session-export-refused" }>;

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

  it("refuses a table at 101 seats, says how many and where to clear them on both layouts", () => {
    const reason = refusal(setup(101));
    expect(reason).toMatch(/would not restore, so it was not saved/);
    expect(reason).toMatch(/101 seats and a backup holds 100/);
    expect(reason).toMatch(
      /remove 1 or more absent players \(DM Menu → Table → Players at this table \(on a phone: ♛ DM → Table\)\)/,
    );
  });

  it("weighs a too-big table in KB, two different numbers, and names maps when maps are the weight", () => {
    const heavy = { id: "heavy", name: "x".repeat(1024 * 1024 + 1) } as unknown as MapDocument;
    const reason = refusal(setup(2, {}, [heavy]));
    expect(reason).toMatch(/at 1,025 KB it is past the 1,023 KB one restore carries/);
    expect(reason).toMatch(/the heaviest parts are 1,025 KB of maps and their waiting scenes/);
  });

  it("names drawings, not maps, when drawings are the weight", () => {
    const stroke = (n: number) => ({ id: `d-${n}`, type: "freehand", points: Array(4000).fill(1) });
    const reason = refusal(setup(2, { drawings: Array.from({ length: 140 }, (_, n) => stroke(n)) }));
    expect(reason).toMatch(/the heaviest parts are [\d,]+ KB of drawings: erase them/);
    expect(reason).toMatch(/Clear All Drawings in DM Menu → Maps/);
  });

  it("refuses when a waiting scene would be left out, and names its map", () => {
    const tokens = Array.from({ length: 1001 }, (_, n) => ({ id: `t-${n}` }));
    const scene = {
      mapDocumentId: "cellar",
      suspendedAt: 1,
      tokens,
      props: [],
      drawings: [],
      sceneObjects: [],
      characterLinks: {},
      doorStates: {},
      combatActive: false,
      initiatives: {},
      fogEnabled: false,
      defaultVisionRadius: null,
    };
    const cellar = { id: "cellar", name: "The Cellar" } as unknown as MapDocument;
    const reason = refusal(setup(2, { sceneStates: { cellar: scene } }, [cellar]));
    expect(reason).toMatch(
      /the scene waiting on the map "The Cellar" would be left out: it has 1,001 tokens \(a backup holds 1,000\)/,
    );
  });

  it("calls a malformed table a fault, not something to clear", () => {
    const reason = refusal(setup(2, { tokens: [5] }));
    expect(reason).toMatch(/does not pass the restore's check/);
    expect(reason).toMatch(/This is a fault, not something to clear/);
    expect(reason).not.toMatch(/Then download it again/);
  });
});
