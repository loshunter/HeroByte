/**
 * An NPC claimed by a player before claim-character took PCs only (2026-09-22)
 * kept that claim in old files, and every owner-or-DM check honoured it: the
 * player could set its initiative modifier, roll it, change its HP or delete
 * it. Every load door drops an NPC's claim; a PC's stays.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Character, RoomSnapshot } from "@herobyte/shared";
import { coerceLoadedCharacters } from "../loadCoercions.js";
import { RoomService } from "../../service.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "npcClaimDropped-state.json");

const characters = [
  { id: "boss", name: "Goblin Boss", type: "npc", hp: 9, maxHp: 9, ownedByPlayerUID: "alice" },
  { id: "aria", name: "Aria", type: "pc", hp: 10, maxHp: 10, ownedByPlayerUID: "alice" },
] as unknown as Character[];

describe("a legacy NPC claim is dropped on load", () => {
  it("the state file and Redis door (coerceLoadedCharacters)", () => {
    const loaded = coerceLoadedCharacters(characters);
    expect(loaded.find((c) => c.id === "boss")).not.toHaveProperty("ownedByPlayerUID");
    expect(loaded.find((c) => c.id === "aria")?.ownedByPlayerUID).toBe("alice");
  });

  it("the session-file door (Restore table backup, a fork)", () => {
    const room = new RoomService({ stateFile: STATE_FILE });
    room.loadSnapshot({ characters } as unknown as RoomSnapshot);
    const loaded = room.getState().characters;
    expect(loaded.find((c) => c.id === "boss")?.ownedByPlayerUID).toBeUndefined();
    expect(loaded.find((c) => c.id === "aria")?.ownedByPlayerUID).toBe("alice");
  });
});
