/**
 * A reconnecting character's token (F4's review, round 1): kept when linked,
 * adopted when exactly one token of the owner's is loose, else spawned. The
 * old gate — "any token this uid owns" — left a DM who had deleted their own
 * token tokenless for good, because a DM owns the NPC tokens they placed.
 */
import { describe, expect, it } from "vitest";
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
  it("a linked character keeps its token — even one the state lacks (stashed by a scene capture): no phantom", () => {
    const { characters, tokens, state, pc } = table();
    pc.tokenId = "stashed";
    const before = state.tokens.length;
    characters.ensureToken(state, tokens, pc.id, "dm-uid", spawnAt);
    expect(state.tokens.length).toBe(before);
    expect(pc.tokenId).toBe("stashed");
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
