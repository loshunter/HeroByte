// A table saved while a demoted DM still held the monsters (before dmDemotion.ts, or a
// file from then) is cleaned on load: the NPC tokens of a uid that is no DM pass to the
// DM role; the next DM to elevate takes them.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RoomService } from "../service.js";
import { DM_ROLE_OWNER } from "../dmDemotion.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "dmDemotion-load-state.json");

describe("loading a table whose monsters a player holds", () => {
  it("passes them to the DM role, and leaves a DM's and a player's own pieces", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({
        players: [
          { uid: "old-dm", name: "Old", isDM: false, hp: 1, maxHp: 1 },
          { uid: "dm", name: "DM", isDM: true, hp: 1, maxHp: 1 },
        ],
        characters: [
          { id: "goblin", name: "Goblin", type: "npc", hp: 7, maxHp: 7, tokenId: "t-goblin" },
          { id: "orc", name: "Orc", type: "npc", hp: 7, maxHp: 7, tokenId: "t-orc" },
          {
            id: "hero",
            name: "Hero",
            type: "pc",
            hp: 9,
            maxHp: 9,
            tokenId: "t-hero",
            ownedByPlayerUID: "old-dm",
          },
        ],
        tokens: [
          { id: "t-goblin", owner: "old-dm", x: 0, y: 0, color: "#123456" },
          { id: "t-orc", owner: "dm", x: 1, y: 0, color: "#123456" },
          { id: "t-hero", owner: "old-dm", x: 2, y: 0, color: "#123456" },
        ],
      }),
    );
    const room = new RoomService({ stateFile: STATE_FILE });
    room.loadState();
    const owner = (id: string) => room.getState().tokens.find((t) => t.id === id)?.owner;
    expect(owner("t-goblin")).toBe(DM_ROLE_OWNER);
    expect(owner("t-orc")).toBe("dm");
    expect(owner("t-hero")).toBe("old-dm");
    vi.restoreAllMocks();
  });
});
