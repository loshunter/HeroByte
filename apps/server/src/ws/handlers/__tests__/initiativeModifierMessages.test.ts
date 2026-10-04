/**
 * set-initiative-modifier sets the modifier ALONE. It exists because
 * restoring a character file through `set-initiative` entered the order,
 * wrote a manual entry to the roll log and — after END COMBAT, which keeps
 * initiatives — started combat again on that character's turn.
 */

import { describe, expect, it } from "vitest";
import type { Character, ClientMessage } from "@herobyte/shared";
import { createEmptyRoomState, type RoomState } from "../../../domains/room/model.js";
import { handleSetInitiativeModifier } from "../initiativeModifierMessages.js";
import { CharacterDispatcher } from "../../dispatchers/CharacterDispatcher.js";
import type { RoutingContext } from "../../services/MessageRoutingContext.js";

function table(): RoomState {
  const state = createEmptyRoomState();
  state.characters.push({
    id: "c-alice",
    type: "pc",
    name: "Kira",
    hp: 10,
    maxHp: 10,
    ownedByPlayerUID: "alice",
    initiative: 15,
    initiativeModifier: 1,
  } as Character);
  state.combatActive = false; // END COMBAT kept Kira's 15
  return state;
}

describe("handleSetInitiativeModifier", () => {
  it("the owner sets the modifier, and nothing else changes", () => {
    const state = table();
    const logBefore = state.diceRolls.length;

    const result = handleSetInitiativeModifier(state, "c-alice", "alice", 3, false);

    expect(result).toEqual({ broadcast: true, save: true });
    expect(state.characters[0]).toMatchObject({ initiative: 15, initiativeModifier: 3 });
    expect(state.combatActive).toBe(false);
    expect(state.currentTurnCharacterId).toBeUndefined();
    expect(state.diceRolls.length).toBe(logBefore);
  });

  it("the DM sets anyone's; another player sets no one's", () => {
    const state = table();

    expect(handleSetInitiativeModifier(state, "c-alice", "bob", 5, false)).toEqual({
      broadcast: false,
      save: false,
    });
    expect(state.characters[0]?.initiativeModifier).toBe(1);
    expect(handleSetInitiativeModifier(state, "c-alice", "dm", 5, true).broadcast).toBe(true);
    expect(state.characters[0]?.initiativeModifier).toBe(5);
  });

  it("an unchanged value or an unknown character is a no-op", () => {
    const state = table();

    expect(handleSetInitiativeModifier(state, "c-alice", "alice", 1, false).broadcast).toBe(false);
    expect(handleSetInitiativeModifier(state, "nobody", "alice", 2, false).broadcast).toBe(false);
  });

  it("is routed by the character dispatcher", () => {
    const state = table();
    const dispatcher = new CharacterDispatcher({} as never, {} as never, {} as never);
    const context = { getState: () => state, isDM: () => false } as unknown as RoutingContext;

    const message: ClientMessage = {
      t: "set-initiative-modifier",
      characterId: "c-alice",
      initiativeModifier: -2,
    };
    expect(dispatcher.dispatch(message, context, "alice")).toEqual({
      broadcast: true,
      save: true,
    });
    expect(state.characters[0]?.initiativeModifier).toBe(-2);
  });

  // As for set-character-owner: the route must pass the context's DM flag, not a
  // literal `true`, or any player could set any character's modifier — and the
  // direct-handler refusal above would still pass.
  it("refuses another player's modifier through the dispatcher", () => {
    const state = table();
    const dispatcher = new CharacterDispatcher({} as never, {} as never, {} as never);
    const context = { getState: () => state, isDM: () => false } as unknown as RoutingContext;
    const message: ClientMessage = {
      t: "set-initiative-modifier",
      characterId: "c-alice",
      initiativeModifier: 5,
    };

    expect(dispatcher.dispatch(message, context, "bob")?.broadcast).toBe(false);
    expect(state.characters[0]?.initiativeModifier).toBe(1);
  });
});
