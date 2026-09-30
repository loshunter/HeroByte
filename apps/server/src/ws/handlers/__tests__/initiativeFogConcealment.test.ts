/**
 * An NPC the fog hides from a player must not be named to that player by its
 * initiative line. The recipient filter strips a fogged NPC's record and token
 * (buildRecipientView), but a PUBLIC roll-log line reached everyone
 * (visibleRollsFor filters on the roll's own visibility): "Goblin —
 * initiative: 14" for a creature the player's fog had removed. The line can
 * only be written once, for every player at once, so while fog is on over a
 * built map any NPC with a token logs its initiative to the DM — rolled or
 * entered by hand — exactly as a 👁-hidden one always has.
 */

import { describe, expect, it } from "vitest";
import type { Player } from "@herobyte/shared";
import { CharacterService } from "../../../domains/character/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";
import { visibleRollsFor } from "../../../domains/room/snapshot/recipientFilter.js";
import { InitiativeMessageHandler } from "../InitiativeMessageHandler.js";
import { InitiativeRollHandler } from "../InitiativeRollHandler.js";

function table(fog: { enabled: boolean; scene: boolean }, placed = true) {
  const characters = new CharacterService();
  const dice = new DiceService();
  const players = new PlayerService();
  const state = createEmptyRoomState();
  state.players = [
    { uid: "dm", name: "The DM", isDM: true },
    { uid: "p1", name: "Pat" },
  ] as unknown as Player[];
  state.fogEnabled = fog.enabled;
  if (fog.scene) state.compiledScene = {} as RoomState["compiledScene"];
  const goblin = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
  if (placed) goblin.tokenId = "t-goblin";
  return {
    state,
    goblinId: goblin.id,
    rolls: new InitiativeRollHandler(characters, dice, players),
    // The room service is not read by the hand-entry path.
    messages: new InitiativeMessageHandler(characters, {} as never, dice, players),
  };
}

const d20 = () => 14;
const playerSees = (state: RoomState) =>
  visibleRollsFor(state.diceRolls, false, "p1").map((roll) => roll.label);

describe("initiative lines and the fog", () => {
  it("a rolled initiative for a placed NPC under fog reaches the DM only", () => {
    const { state, rolls } = table({ enabled: true, scene: true });
    rolls.handleRollInitiativeAll(state, "dm", true, d20);

    expect(state.diceRolls).toHaveLength(1);
    expect(state.diceRolls[0].visibility).toBe("dm");
    expect(playerSees(state)).toEqual([]);
  });

  it("so does one entered by hand", () => {
    const { state, messages, goblinId } = table({ enabled: true, scene: true });
    messages.handleSetInitiative(state, goblinId, "dm", 12, 0, true);

    expect(state.diceRolls).toHaveLength(1);
    expect(playerSees(state)).toEqual([]);
  });

  it("without fog, or without a built map (no fog filter runs), the line stays public", () => {
    for (const fog of [
      { enabled: false, scene: true },
      { enabled: true, scene: false },
    ]) {
      const { state, rolls } = table(fog);
      rolls.handleRollInitiativeAll(state, "dm", true, d20);
      expect(playerSees(state)).toEqual(["Goblin — initiative"]);
    }
  });

  it("an NPC with no token on the map is never fogged, so its line stays public", () => {
    const { state, rolls } = table({ enabled: true, scene: true }, false);
    rolls.handleRollInitiativeAll(state, "dm", true, d20);
    expect(playerSees(state)).toEqual(["Goblin — initiative"]);
  });
});
