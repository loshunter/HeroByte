import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Container } from "../../../container.js";
import { PlayerService } from "../../../domains/player/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { RoomService } from "../../../domains/room/service.js";
import { ChatService } from "../../../domains/chat/service.js";
import { removePlayer, REMOVE_PLAYER_GRACE_MS } from "../../handlers/removePlayer.js";
import { provisionJoin } from "../joinProvisioning.js";

function setup() {
  const services = {
    playerService: new PlayerService(),
    characterService: new CharacterService(),
    tokenService: new TokenService(),
    selectionService: new SelectionService(),
  };
  // Provisioning and direct removal do not save; keep even an accidental save isolated.
  const room = new RoomService({
    stateFile: path.join(process.cwd(), ".tmp", "joinProvisioning-naming-state.json"),
  });
  const state = room.getState();
  const join = (uid: string) => provisionJoin(services as Container, room, state, uid);
  return { ...services, state, join };
}

describe("join provisioning names", () => {
  it("gives a removed UID a fresh uniquely named seat and PC without rewriting its old whisper", () => {
    const { state, join, ...services } = setup();
    for (let i = 1; i <= 4; i++) join(`uid-${i}`);
    const removed = state.players.find((player) => player.uid === "uid-2")!;
    removed.isDM = true;
    removed.hp = 7;
    removed.lastHeartbeat = Date.now() - REMOVE_PLAYER_GRACE_MS - 1;
    const oldPc = state.characters.find((character) => character.ownedByPlayerUID === "uid-2")!;
    oldPc.name = "Old hero";
    oldPc.hp = 9;
    const oldTokenId = oldPc.tokenId;
    new ChatService().addMessage(state, "uid-3", "Player 3", "Before removal", "uid-2");
    const historyBefore = structuredClone(state.chatLog);

    expect(
      removePlayer({ ...services, hasLiveSocket: () => false }, state, "uid-2", "uid-1"),
    ).toEqual({ broadcast: true, save: true });
    expect(state.players.some((player) => player.uid === "uid-2")).toBe(false);
    expect(state.characters.some((character) => character.id === oldPc.id)).toBe(false);
    const returned = join("uid-2");
    const newPc = state.characters.find((character) => character.ownedByPlayerUID === "uid-2")!;

    expect.soft(returned.name).toBe("Player 5");
    expect.soft(newPc.name).toBe("Player 5");
    expect(returned).not.toBe(removed);
    expect(returned).toMatchObject({ uid: "uid-2", isDM: false, hp: 100, maxHp: 100 });
    expect(newPc).toMatchObject({ type: "pc", ownedByPlayerUID: "uid-2", hp: 100, maxHp: 100 });
    expect(newPc.id).not.toBe(oldPc.id);
    expect(newPc.tokenId).not.toBe(oldTokenId);
    expect(state.tokens.some((token) => token.id === oldTokenId)).toBe(false);
    expect(state.tokens.find((token) => token.id === newPc.tokenId)?.owner).toBe("uid-2");
    expect(state.players.map((player) => player.name)).toEqual([
      "Player 1",
      "Player 3",
      "Player 4",
      "Player 5",
    ]);
    expect(state.chatLog).toEqual(historyBefore);
    expect(state.chatLog[0]).toMatchObject({ to: "uid-2", toName: "Player 2" });
  });

  it("preserves an existing custom-named seat, PC and token on ordinary reconnect", () => {
    const { state, join, playerService } = setup();
    const player = join("uid-1");
    playerService.rename(state, "uid-1", "Alice");
    playerService.setDMMode(state, "uid-1", true);
    const pc = state.characters[0]!;
    pc.name = "My hero";
    pc.hp = 12;
    const before = structuredClone({
      players: state.players,
      characters: state.characters,
      tokens: state.tokens,
    });

    expect(join("uid-1")).toBe(player);
    expect(state.characters[0]).toBe(pc);
    expect({ players: state.players, characters: state.characters, tokens: state.tokens }).toEqual(
      before,
    );
  });
});
