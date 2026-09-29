// The map's condition badges follow the cards' rule (UX-02): a character's
// conditions are its own — an explicitly empty list included — and the legacy
// per-player list is attributable only to a player's SOLE character. The write
// path mirrors a player's own character onto that per-player list, so a second
// character used to wear its sibling's conditions on the map while its card
// showed none; and a DM clearing a player's condition left the token badged.

import { describe, expect, it } from "vitest";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { conditionsByTokenId } from "../tokenConditions";

const ALICE = "alice-uid";

const alice = (statusEffects: string[]) =>
  ({ uid: ALICE, name: "Alice", isDM: false, statusEffects }) as unknown as Player;

const pc = (id: string, tokenId: string | undefined, statusEffects?: string[]) =>
  ({
    id,
    name: id,
    type: "pc",
    ownedByPlayerUID: ALICE,
    tokenId,
    hp: 10,
    maxHp: 10,
    statusEffects,
  }) as unknown as SnapshotCharacter;

const labels = (map: ReturnType<typeof conditionsByTokenId>, tokenId: string) =>
  (map[`token:${tokenId}`] ?? []).map((option) => option.label);

describe("conditionsByTokenId", () => {
  it("keeps one character's condition off its sibling's token", () => {
    const map = conditionsByTokenId(
      [pc("ranger", "t-ranger", ["poisoned"]), pc("companion", "t-companion")],
      [alice(["poisoned"])],
    );

    expect(labels(map, "t-ranger")).toEqual(["Poisoned"]);
    expect(labels(map, "t-companion")).toEqual([]);
  });

  it("respects an explicitly empty list — a DM's clear is not undone by the legacy list", () => {
    const map = conditionsByTokenId([pc("solo", "t-solo", [])], [alice(["poisoned"])]);

    expect(labels(map, "t-solo")).toEqual([]);
  });

  it("still badges a sole character from the legacy per-player list", () => {
    const map = conditionsByTokenId([pc("solo", "t-solo")], [alice(["prone"])]);

    expect(labels(map, "t-solo")).toEqual(["Prone"]);
  });

  it("an NPC carrying the DM's uid wears none of the DM's seat conditions", () => {
    // The real case: an NPC the DM placed can carry the DM's uid as its owner.
    // The DM's seat list belongs to the DM's own sole character, not to it.
    const DM = "dm-uid";
    const dmSeat = {
      uid: DM,
      name: "DM",
      isDM: true,
      statusEffects: ["prone"],
    } as unknown as Player;
    const dmCharacter = {
      ...pc("dm-hero", "t-dm-hero"),
      ownedByPlayerUID: DM,
    } as SnapshotCharacter;
    const goblin = {
      id: "goblin",
      name: "Goblin",
      type: "npc",
      ownedByPlayerUID: DM,
      tokenId: "t-goblin",
    } as unknown as SnapshotCharacter;
    const map = conditionsByTokenId([dmCharacter, goblin], [dmSeat]);

    expect(labels(map, "t-dm-hero")).toEqual(["Prone"]);
    expect(labels(map, "t-goblin")).toEqual([]);
  });

  it("badges an NPC from its own list and skips a character with no token", () => {
    const goblin = {
      id: "goblin",
      name: "Goblin",
      type: "npc",
      ownedByPlayerUID: null,
      tokenId: "t-goblin",
      statusEffects: ["blinded"],
    } as unknown as SnapshotCharacter;
    const map = conditionsByTokenId([goblin, pc("benched", undefined, ["prone"])], []);

    expect(labels(map, "t-goblin")).toEqual(["Blinded"]);
    expect(Object.keys(map)).toEqual(["token:t-goblin"]);
  });
});
