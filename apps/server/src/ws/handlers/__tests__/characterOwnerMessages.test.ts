/**
 * set-character-owner: the DM moves a player character and its token to
 * another seat. Ownership decides who may move the token, whose fog it lights
 * and whose Party row it is, so the token must follow the character.
 */

import { describe, expect, it } from "vitest";
import type { Character, ClientMessage, Player, Token } from "@herobyte/shared";
import { createEmptyRoomState, type RoomState } from "../../../domains/room/model.js";
import { handleSetCharacterOwner } from "../characterOwnerMessages.js";
import { CharacterDispatcher } from "../../dispatchers/CharacterDispatcher.js";
import type { RoutingContext } from "../../services/MessageRoutingContext.js";

function table(): RoomState {
  const state = createEmptyRoomState();
  state.players.push(
    { uid: "alice", name: "Alice" } as Player,
    { uid: "bob", name: "Bob" } as Player,
    { uid: "dm", name: "DM", isDM: true } as Player,
  );
  state.characters.push(
    {
      id: "c-wolf",
      type: "pc",
      name: "Wolf",
      hp: 10,
      maxHp: 10,
      ownedByPlayerUID: "alice",
      tokenId: "t-wolf",
    } as Character,
    { id: "npc-goblin", type: "npc", name: "Goblin", hp: 7, maxHp: 7 } as Character,
  );
  state.tokens.push({ id: "t-wolf", owner: "alice", x: 0, y: 0, color: "#fff" } as Token);
  return state;
}

describe("handleSetCharacterOwner", () => {
  it("the DM moves a player character and its token to another seat", () => {
    const state = table();

    expect(handleSetCharacterOwner(state, "c-wolf", "bob", "dm", true)).toEqual({
      broadcast: true,
      save: true,
    });
    expect(state.characters[0]?.ownedByPlayerUID).toBe("bob");
    expect(state.tokens[0]?.owner).toBe("bob");
  });

  it("a player cannot, not even the owner", () => {
    const state = table();

    expect(handleSetCharacterOwner(state, "c-wolf", "bob", "alice", false).broadcast).toBe(false);
    expect(state.characters[0]?.ownedByPlayerUID).toBe("alice");
    expect(state.tokens[0]?.owner).toBe("alice");
  });

  it("never hands an NPC to a player, nor anyone to a seat that is not at the table", () => {
    const state = table();

    expect(handleSetCharacterOwner(state, "npc-goblin", "bob", "dm", true).broadcast).toBe(false);
    expect(state.characters[1]?.ownedByPlayerUID).toBeUndefined();
    expect(handleSetCharacterOwner(state, "c-wolf", "stranger", "dm", true).broadcast).toBe(false);
    expect(state.characters[0]?.ownedByPlayerUID).toBe("alice");
  });

  it("the same owner is a no-op", () => {
    expect(handleSetCharacterOwner(table(), "c-wolf", "alice", "dm", true).broadcast).toBe(false);
  });

  it("is routed by the character dispatcher", () => {
    const state = table();
    const dispatcher = new CharacterDispatcher({} as never, {} as never, {} as never);
    const context = { getState: () => state, isDM: () => true } as unknown as RoutingContext;
    const message: ClientMessage = {
      t: "set-character-owner",
      characterId: "c-wolf",
      ownerUid: "bob",
    };

    expect(dispatcher.dispatch(message, context, "dm")).toEqual({ broadcast: true, save: true });
    expect(state.tokens[0]?.owner).toBe("bob");
  });

  // The route must hand the handler the SENDER's DM flag: a literal `true` (or the
  // wrong uid's flag) would let any player take any character, its token, its sight
  // and its Party row — and every direct-handler test above would still pass.
  it.each([
    ["the owner giving it away", "alice", "bob"],
    ["another player taking it", "bob", "bob"],
  ])("refuses a player through the dispatcher: %s", (_case, sender, ownerUid) => {
    const state = table();
    const dispatcher = new CharacterDispatcher({} as never, {} as never, {} as never);
    // The routing context answers for the sender of this message: a player.
    const context = { getState: () => state, isDM: () => false } as unknown as RoutingContext;
    const message: ClientMessage = { t: "set-character-owner", characterId: "c-wolf", ownerUid };

    expect(dispatcher.dispatch(message, context, sender).broadcast).toBe(false);
    expect(state.characters[0]?.ownedByPlayerUID).toBe("alice");
    expect(state.tokens[0]?.owner).toBe("alice");
  });
});
