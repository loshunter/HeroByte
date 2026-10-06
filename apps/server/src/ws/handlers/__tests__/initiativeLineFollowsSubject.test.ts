/**
 * A public initiative line follows its character out of a player's view.
 * initiativeLineConcealed decides once, at roll time; buildRecipientView
 * re-checks the character on every broadcast. An NPC the table could see when
 * it rolled, then hidden with the 👁 eye (or fogged since), left its record
 * and turn pointer behind while its line kept naming it to every player.
 */

import { describe, expect, it } from "vitest";
import type { Player } from "@herobyte/shared";
import { CharacterService } from "../../../domains/character/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import { buildRecipientView } from "../../../domains/room/snapshot/recipientFilter.js";
import { InitiativeMessageHandler } from "../InitiativeMessageHandler.js";
import { InitiativeRollHandler } from "../InitiativeRollHandler.js";

function table() {
  const characters = new CharacterService();
  const dice = new DiceService();
  const players = new PlayerService();
  const state = createEmptyRoomState();
  state.players = [
    { uid: "dm", name: "The DM", isDM: true },
    { uid: "p1", name: "Pat" },
  ] as unknown as Player[];
  const goblin = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
  return {
    state,
    goblin,
    rolls: new InitiativeRollHandler(characters, dice, players),
    messages: new InitiativeMessageHandler(characters, {} as never, dice, players),
  };
}

const labelsFor = (state: ReturnType<typeof table>["state"], isDM: boolean, uid: string) =>
  buildRecipientView(state, isDM, uid).diceRolls.map((roll) => roll.label);

describe("an initiative line and its character's visibility", () => {
  it.each(["rolled", "entered by hand"] as const)(
    "%s: public while the NPC is seen, gone for players once it is hidden, back when shown",
    (how) => {
      const { state, goblin, rolls, messages } = table();
      if (how === "rolled") rolls.handleRollInitiativeAll(state, "dm", true, () => 14);
      else messages.handleSetInitiative(state, goblin.id, "dm", 12, 0, true);
      expect(state.diceRolls[0]?.subjectCharacterId).toBe(goblin.id);
      expect(labelsFor(state, false, "p1")).toEqual(["Goblin — initiative"]);

      // createCharacter hands back a copy: hide the record the table holds.
      const record = state.characters.find((c) => c.id === goblin.id)!;
      record.visibleToPlayers = false;
      expect(labelsFor(state, false, "p1")).toEqual([]);
      expect(labelsFor(state, true, "dm")).toEqual(["Goblin — initiative"]);

      record.visibleToPlayers = true;
      expect(labelsFor(state, false, "p1")).toEqual(["Goblin — initiative"]);
    },
  );

  it("a plain roll, and a line about a character since deleted, are untouched", () => {
    const { state, goblin, rolls } = table();
    rolls.handleRollInitiativeAll(state, "dm", true, () => 14);
    state.diceRolls.push({
      ...state.diceRolls[0]!,
      id: "plain",
      label: undefined,
      subjectCharacterId: undefined,
    });
    state.characters = state.characters.filter((c) => c.id !== goblin.id);
    const other = { ...goblin, id: "hidden-one", visibleToPlayers: false };
    state.characters.push(other);
    expect(labelsFor(state, false, "p1")).toEqual(["Goblin — initiative", undefined]);
  });
});
