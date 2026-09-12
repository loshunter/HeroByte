/**
 * The initiative order consults the shared `isInInitiativeOrder` — pinned by
 * MOCKING it, because today its yes-set equals "has an initiative" and no
 * fixture can tell the helper's filter from that one. The day the rule grows
 * a real exclusion this is the seam it travels through.
 */
import { describe, expect, it, vi } from "vitest";
import type { Player } from "@herobyte/shared";

const excluded = { id: "" };
vi.mock("@herobyte/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@herobyte/shared")>();
  return {
    ...actual,
    isInInitiativeOrder: (
      character: Parameters<typeof actual.isInInitiativeOrder>[0] & { id?: string },
      players: Player[],
    ) => (character.id === excluded.id ? false : actual.isInInitiativeOrder(character, players)),
  };
});

import { CharacterService } from "../character/service.js";
import { createEmptyRoomState } from "../room/model.js";

describe("CharacterService.getCharactersInInitiativeOrder reads the shared helper", () => {
  it("a character the helper refuses is out of the order even with a roll on file", () => {
    const service = new CharacterService();
    const state = createEmptyRoomState();
    state.players = [{ uid: "p-uid", name: "Pat", isDM: false }] as unknown as Player[];
    const pat = service.createCharacter(state, "Pat", 30, undefined, "pc");
    pat.ownedByPlayerUID = "p-uid";
    pat.initiative = 12;
    const sam = service.createCharacter(state, "Sam", 30, undefined, "pc");
    sam.ownedByPlayerUID = "p-uid";
    sam.initiative = 9;
    excluded.id = pat.id;
    expect(service.getCharactersInInitiativeOrder(state).map((c) => c.id)).toEqual([sam.id]);
    excluded.id = "";
    expect(service.getCharactersInInitiativeOrder(state).map((c) => c.id)).toEqual([
      pat.id,
      sam.id,
    ]);
  });
});
