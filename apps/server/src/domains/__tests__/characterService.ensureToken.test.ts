/**
 * A reconnecting character's token (F4's review, rounds 1 and 2): kept when
 * linked and live or stashed, re-tokened when the link is dead, adopted when
 * exactly one token of the owner's is loose and the owner runs one PC, else
 * spawned. The old gate — "any token this uid owns" — left a DM who had
 * deleted their own token tokenless for good, because a DM owns the NPC
 * tokens they placed; the first replacement stranded a legacy dead link.
 */
import { describe, expect, it } from "vitest";
import type { RoomState } from "../room/model.js";
import { CharacterService } from "../character/service.js";
import { TokenService } from "../token/service.js";
import { createEmptyRoomState } from "../room/model.js";

const spawnAt = () => ({ x: 5, y: 5 });

function table() {
  const characters = new CharacterService();
  const tokens = new TokenService();
  const state = createEmptyRoomState();
  const pc = characters.createCharacter(state, "Dee", 30, undefined, "pc");
  characters.claimCharacter(state, pc.id, "dm-uid");
  return { characters, tokens, state, pc };
}

describe("CharacterService.ensureToken", () => {
  it("a linked character keeps its live token — nothing spawned, the link untouched, a goblin of the DM's beside it ignored", () => {
    const { characters, tokens, state, pc } = table();
    // The goblin sorts FIRST among the tokens the DM owns: the link, not
    // ownership, must decide (round 3: the lookup was unpinned against
    // "the first token this uid owns").
    const goblin = tokens.createToken(state, "dm-uid", 9, 9);
    const own = tokens.createToken(state, "dm-uid", 1, 1);
    characters.linkToken(state, pc.id, own.id);
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token?.id).toBe(own.id);
    expect(token?.id).not.toBe(goblin.id);
    expect(state.tokens).toHaveLength(2);
    expect(pc.tokenId).toBe(own.id);
  });

  it("a link a scene capture holds is STASHED, not dead: nothing spawned, the link kept — no phantom", () => {
    const { characters, tokens, state, pc } = table();
    const own = tokens.createToken(state, "dm-uid", 1, 1);
    characters.linkToken(state, pc.id, own.id);
    // The capture moves the token out of state.tokens and into a scene.
    state.sceneStates["doc-a"] = { tokens: [own] } as unknown as RoomState["sceneStates"][string];
    state.tokens.length = 0;
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token).toBeUndefined();
    expect(state.tokens).toHaveLength(0);
    expect(pc.tokenId).toBe(own.id);
  });

  it("a link NO scene holds is dead: cleared, and the character re-tokened like an unlinked one — never handed a goblin", () => {
    const { characters, tokens, state, pc } = table();
    const gob = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
    characters.placeNPCToken(state, tokens, gob.id, "dm-uid");
    const goblinToken = gob.tokenId as string;
    pc.tokenId = "deleted-before-unlink-shipped";
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token).toMatchObject({ owner: "dm-uid", x: 5, y: 5 });
    expect(token?.id).not.toBe(goblinToken);
    expect(pc.tokenId).toBe(token?.id);
    expect(gob.tokenId).toBe(goblinToken);
    expect(state.tokens).toHaveLength(2);
  });

  it("a scene capture that holds OTHER tokens does not make a dead link stashed", () => {
    const { characters, tokens, state, pc } = table();
    const other = tokens.createToken(state, "player-2", 2, 2);
    state.sceneStates["doc-a"] = { tokens: [other] } as unknown as RoomState["sceneStates"][string];
    state.tokens.length = 0;
    pc.tokenId = "deleted-before-unlink-shipped";
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token).toMatchObject({ owner: "dm-uid", x: 5, y: 5 });
    expect(pc.tokenId).toBe(token?.id);
  });

  it("a claimed NPC is not a second PC: the one loose token is still adopted", () => {
    // claimCharacter has no type gate, so an owned NPC is a producible shape.
    const { characters, tokens, state, pc } = table();
    const gob = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
    characters.claimCharacter(state, gob.id, "dm-uid");
    const loose = tokens.createToken(state, "dm-uid", 1, 1);
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token?.id).toBe(loose.id);
    expect(state.tokens).toHaveLength(1);
  });

  it("a character that is gone gets nothing — and nothing is spawned for it", () => {
    const { characters, tokens, state } = table();
    expect(characters.ensureToken(state, tokens, "no-such-id", "dm-uid", spawnAt)).toBeUndefined();
    expect(state.tokens).toHaveLength(0);
  });

  it("another player's loose token is never adopted — a fresh one is spawned instead", () => {
    const { characters, tokens, state, pc } = table();
    const theirs = tokens.createToken(state, "player-2", 9, 9);
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token?.id).not.toBe(theirs.id);
    expect(token?.owner).toBe("dm-uid");
    expect(theirs.owner).toBe("player-2");
    expect(pc.tokenId).toBe(token?.id);
    expect(state.tokens).toHaveLength(2);
  });

  it("an owner running TWO PCs adopts nothing — the loose token would be a guess — and is spawned one", () => {
    const { characters, tokens, state, pc } = table();
    const second = characters.createCharacter(state, "Dee II", 30, undefined, "pc");
    characters.claimCharacter(state, second.id, "dm-uid");
    const loose = tokens.createToken(state, "dm-uid", 1, 1);
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token?.id).not.toBe(loose.id);
    expect(pc.tokenId).toBe(token?.id);
    expect(second.tokenId).toBeFalsy();
    expect(state.tokens).toHaveLength(2);
  });

  it("a DM whose own token is gone gets a NEW one beside the goblins they own — the goblin stays the goblin's", () => {
    const { characters, tokens, state, pc } = table();
    const gob = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
    characters.placeNPCToken(state, tokens, gob.id, "dm-uid");
    const goblinToken = gob.tokenId as string;
    expect(pc.tokenId).toBeFalsy();
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token).toBeDefined();
    expect(token?.id).not.toBe(goblinToken);
    expect(pc.tokenId).toBe(token?.id);
    expect(gob.tokenId).toBe(goblinToken);
    expect(state.tokens.map((t) => t.id).sort()).toEqual([goblinToken, token?.id].sort());
  });

  it("one loose token of the owner's (predates linking) is adopted, not duplicated", () => {
    const { characters, tokens, state, pc } = table();
    const loose = tokens.createToken(state, "dm-uid", 1, 1);
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token?.id).toBe(loose.id);
    expect(pc.tokenId).toBe(loose.id);
    expect(state.tokens).toHaveLength(1);
  });

  it("two loose tokens is a guess — a fresh one is spawned and linked instead", () => {
    const { characters, tokens, state, pc } = table();
    const a = tokens.createToken(state, "dm-uid", 1, 1);
    const b = tokens.createToken(state, "dm-uid", 2, 2);
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect([a.id, b.id]).not.toContain(token?.id);
    expect(pc.tokenId).toBe(token?.id);
    expect(state.tokens).toHaveLength(3);
  });

  it("no token at all: spawned at the given spot and linked", () => {
    const { characters, tokens, state, pc } = table();
    const token = characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(token).toMatchObject({ owner: "dm-uid", x: 5, y: 5 });
    expect(pc.tokenId).toBe(token?.id);
  });
});
