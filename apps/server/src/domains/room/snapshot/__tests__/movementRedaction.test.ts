// A monster's movement budget is DM information on the wire; a PC's is the
// party's. Checked at the pure function and through buildRecipientView, so
// the wiring cannot be silently dropped.

import { describe, expect, it } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { createEmptyRoomState } from "../../model.js";
import { buildRecipientView } from "../recipientFilter.js";
import { redactNpcMovement } from "../movementRedaction.js";

const pc: SnapshotCharacter = {
  id: "pc",
  type: "pc",
  name: "Fighter",
  hp: 10,
  maxHp: 10,
  speed: 25,
  movementUsed: 10,
  movementDiagonals: 1,
};
const npc: SnapshotCharacter = {
  id: "npc",
  type: "npc",
  name: "Goblin",
  hp: 7,
  maxHp: 7,
  speed: 30,
  movementUsed: 15,
  movementDiagonals: 2,
};
const bare: SnapshotCharacter = { id: "bare", type: "npc", name: "Statue", hp: 1, maxHp: 1 };

describe("redactNpcMovement", () => {
  it("strips speed, spend and the diagonal count from NPCs for a player, keeps a PC's whole", () => {
    const out = redactNpcMovement([pc, npc, bare], false);
    expect(out[0]).toBe(pc);
    expect(out[1]).toEqual({ id: "npc", type: "npc", name: "Goblin", hp: 7, maxHp: 7 });
    expect(out[1]).not.toBe(npc);
    expect(npc.speed, "must not mutate live state").toBe(30);
    // Nothing to strip: the same record, no clone.
    expect(out[2]).toBe(bare);
  });

  it("the DM sees everything", () => {
    expect(redactNpcMovement([pc, npc], true)).toEqual([pc, npc]);
  });
});

describe("buildRecipientView carries the redaction", () => {
  it("a player's frame has no NPC budget bytes; the DM's does", () => {
    const state = createEmptyRoomState();
    // RoomState holds full Characters (hp required); the fixtures above are
    // wire-shaped, so re-assert the numbers here.
    state.characters = [
      { ...pc, hp: 10, maxHp: 10 },
      { ...npc, hp: 7, maxHp: 7 },
    ];
    const playerView = JSON.stringify(buildRecipientView(state, false, "someone").characters);
    expect(playerView).toContain('"speed":25');
    expect(playerView).not.toContain('"speed":30');
    expect(playerView).not.toContain('"movementUsed":15');
    const dmView = JSON.stringify(buildRecipientView(state, true).characters);
    expect(dmView).toContain('"movementUsed":15');
  });
});
