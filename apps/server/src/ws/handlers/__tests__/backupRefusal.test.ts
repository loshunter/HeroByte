// A table backup that Restore would refuse is not handed over: the DM is told why, so
// they can clear absent seats, NPCs or maps and save again (the owner's rule,
// 2026-10-13). Past 100 seats the load check refuses the file whole; past the
// wire limit ws drops the frame before any handler sees it.

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

describe("Download table backup refuses a file Restore would refuse", () => {
  afterEach(() => vi.restoreAllMocks());

  const setup = (seats: number, mapDocuments: MapDocument[] = []) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const roomService = new RoomService({ stateFile: STATE_FILE });
    roomService.setState({
      players: [seat("dm", true), ...Array.from({ length: seats - 1 }, (_, n) => seat(`p-${n}`))],
      users: ["dm"],
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

  it("hands over a table at 100 seats", () => {
    const sent = setup(100);
    expect(sent.map((message) => ("t" in message ? message.t : null))).toEqual(["session-file"]);
  });

  it("refuses a table at 101 seats, says how many and how to fix it, and sends no file", () => {
    const sent = setup(101);
    expect(sent).toHaveLength(1);
    const refusal = sent[0] as Extract<ServerMessage, { t: "session-export-refused" }>;
    expect(refusal.t).toBe("session-export-refused");
    expect(refusal.reason).toMatch(/would not restore, so it was not saved/);
    expect(refusal.reason).toMatch(/101 seats and a backup holds 100/);
    expect(refusal.reason).toMatch(
      /remove 1 or more absent players \(DM Menu → Table → Players at this table\)/,
    );
  });

  it("refuses a table whose restore would not fit in one message", () => {
    const heavy = { id: "heavy", name: "x".repeat(1024 * 1024 + 1) } as unknown as MapDocument;
    const sent = setup(2, [heavy]);
    const refusal = sent[0] as Extract<ServerMessage, { t: "session-export-refused" }>;
    expect(refusal.t).toBe("session-export-refused");
    expect(refusal.reason).toMatch(/past the 1\.0 MB one restore carries/);
  });
});
