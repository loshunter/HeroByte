// The Encounter roster must list the fight in the order the SERVER runs it
// (CharacterService.getCharactersInInitiativeOrder), or "Turn N of M" and the
// turn mark would disagree with what next-turn does.

import { describe, expect, it } from "vitest";
import { buildEncounterRoster } from "../encounterRoster";
import { ALICE_UID, DM_UID, npc, pc, seat } from "./encounterFixtures";

const players = [seat(DM_UID, "The DM", true), seat(ALICE_UID, "Alice")];

describe("buildEncounterRoster", () => {
  it("orders by initiative, a player's character before an NPC on a tie, then creation order", () => {
    const characters = [
      npc("gob-1", "Goblin 1", { initiative: 12 }),
      pc("alice", "Alice", ALICE_UID, { initiative: 12 }),
      npc("gob-2", "Goblin 2", { initiative: 12 }),
      npc("ogre", "Ogre", { initiative: 18 }),
    ];

    const { order } = buildEncounterRoster(characters, players, false, undefined);

    expect(order.map((p) => p.character.id)).toEqual(["ogre", "alice", "gob-1", "gob-2"]);
  });

  it("breaks a same-type tie by creation order, not by name", () => {
    const characters = [
      npc("zed", "Zed", { initiative: 12 }),
      npc("abe", "Abe", { initiative: 12 }),
    ];
    const { order } = buildEncounterRoster(characters, players, false, undefined);
    expect(order.map((p) => p.character.id)).toEqual(["zed", "abe"]);
  });

  it("puts everyone without a roll under waiting — the DM's own unrolled character included", () => {
    const characters = [
      npc("gob", "Goblin"),
      pc("alice", "Alice", ALICE_UID),
      pc("ally", "Sidekick", DM_UID),
      npc("ogre", "Ogre", { initiative: 9 }),
    ];

    const { order, waiting } = buildEncounterRoster(characters, players, true, undefined);

    expect(order.map((p) => p.character.id)).toEqual(["ogre"]);
    expect(waiting.map((p) => [p.character.id, p.kind])).toEqual([
      ["gob", "npc"],
      ["alice", "player"],
      ["ally", "dm"],
    ]);
  });

  it("a DM's character that has rolled stands in the order (F3), tagged as the DM's", () => {
    const characters = [pc("ally", "Sidekick", DM_UID, { initiative: 15 })];

    const { order } = buildEncounterRoster(characters, players, true, undefined);

    expect(order.map((p) => [p.character.id, p.kind, p.seatName])).toEqual([
      ["ally", "dm", "The DM"],
    ]);
  });

  it("marks the turn holder only while combat is on, and says where it stands", () => {
    const characters = [
      npc("gob", "Goblin", { initiative: 3 }),
      npc("ogre", "Ogre", { initiative: 19 }),
    ];

    const running = buildEncounterRoster(characters, players, true, "gob");
    expect(running.turnIndex).toBe(1);
    expect(running.order[1].isCurrentTurn).toBe(true);

    const over = buildEncounterRoster(characters, players, false, "gob");
    expect(over.turnIndex).toBe(-1);
    expect(over.order.some((p) => p.isCurrentTurn)).toBe(false);
  });

  it("flags a hidden NPC, and only an NPC", () => {
    const characters = [
      npc("ambush", "Assassin", { visibleToPlayers: false }),
      npc("gob", "Goblin", { visibleToPlayers: true }),
      pc("alice", "Alice", ALICE_UID, { visibleToPlayers: false }),
    ];

    const { waiting } = buildEncounterRoster(characters, players, false, undefined);

    expect(waiting.map((p) => p.hidden)).toEqual([true, false, false]);
  });
});
