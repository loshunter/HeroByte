/**
 * CHARACTERIZATION — the two server rules the Encounter tab (U8) names and uses.
 *
 * Neither is changed by U8; both are pinned here, with the real services, so the
 * tab's copy cannot drift from what the server does:
 *
 * 1. An initiative saved while no fight is running starts combat on THAT
 *    character's turn. A bulk "Roll missing NPC initiative" on a fresh fight
 *    therefore hands the turn to the first NPC it rolls (creation order), not
 *    to the highest roll.
 * 2. `start-combat` while a fight is already on is accepted: the turn moves to
 *    the top of the order, the round starts over at 1 and every movement budget
 *    refills. Encounter's "Start at top of order" sends exactly that message.
 */

import { describe, expect, it } from "vitest";
import type { Player } from "@herobyte/shared";
import { CharacterService } from "../../../domains/character/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import { InitiativeMessageHandler } from "../InitiativeMessageHandler.js";
import { InitiativeRollHandler } from "../InitiativeRollHandler.js";

function table() {
  const characters = new CharacterService();
  const dice = new DiceService();
  const players = new PlayerService();
  const state = createEmptyRoomState();
  state.players = [{ uid: "dm", name: "The DM", isDM: true }] as unknown as Player[];
  const goblin = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
  const orc = characters.createCharacter(state, "Orc", 15, undefined, "npc");
  const rat = characters.createCharacter(state, "Rat", 2, undefined, "npc");
  // setInitiative REPLACES the record, so read it from state, never hold it.
  const live = (id: string) => state.characters.find((c) => c.id === id)!;
  return {
    state,
    goblin: { id: goblin.id, get: () => live(goblin.id) },
    orc: { id: orc.id, get: () => live(orc.id) },
    rat: { id: rat.id, get: () => live(rat.id) },
    service: characters,
    // The room service is not read by the handlers exercised here.
    messages: new InitiativeMessageHandler(characters, {} as never, dice, players),
    rolls: new InitiativeRollHandler(characters, dice, players),
  };
}

/** A die that lands on `faces` in order (a DiceRng returns the face itself). */
const dieLanding = (...faces: number[]) => {
  let i = 0;
  return () => faces[i++ % faces.length];
};

describe("Encounter rules the tab names (characterization)", () => {
  it("a bulk roll on a fresh fight starts combat on the FIRST NPC rolled — neither the top nor the bottom of the order", () => {
    const { state, goblin, orc, rat, rolls } = table();

    // Rolled in creation order: the Goblin 10 (the middle), the Orc 19, the Rat 3.
    rolls.handleRollInitiativeAll(state, "dm", true, dieLanding(10, 19, 3));

    expect([goblin, orc, rat].map((c) => c.get().initiative)).toEqual([10, 19, 3]);
    expect(state.combatActive).toBe(true);
    expect(state.currentTurnCharacterId).toBe(goblin.id);
  });

  it("start-combat mid-fight moves the turn to the top of the order, restarts the round and refills every budget", () => {
    const { state, goblin, orc, rolls, messages, service } = table();
    rolls.handleRollInitiativeAll(state, "dm", true, dieLanding(10, 19, 3));
    state.combatRound = 4;
    goblin.get().movementUsed = 20;
    orc.get().movementUsed = 10;
    // "Everyone's", not only the order's: a character who never rolled refills too.
    const bystander = service.createCharacter(state, "Bystander", 10, undefined, "pc");
    bystander.movementUsed = 5;

    const result = messages.handleStartCombat(state, "dm", true);

    expect(result).toEqual({ broadcast: true, save: true });
    expect(state.combatActive).toBe(true);
    expect(state.currentTurnCharacterId).toBe(orc.id);
    expect(state.combatRound).toBe(1);
    expect(goblin.get().movementUsed).toBe(0);
    expect(orc.get().movementUsed).toBe(0);
    expect(state.characters.find((c) => c.name === "Bystander")?.movementUsed).toBe(0);
  });

  it("a player cannot send it: start-combat stays DM-only mid-fight too", () => {
    const { state, goblin, rolls, messages } = table();
    rolls.handleRollInitiativeAll(state, "dm", true, dieLanding(10, 19, 3));

    expect(messages.handleStartCombat(state, "player", false)).toEqual({
      broadcast: false,
      save: false,
    });
    expect(state.currentTurnCharacterId).toBe(goblin.id);
  });
});
