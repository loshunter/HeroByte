import { describe, expect, it } from "vitest";
import type { Character, SceneState, SnapshotCharacter, Token } from "@herobyte/shared";
import { createEmptyRoomState } from "../../model.js";
import { loosePcColours, pcTokenColours, withPcColors } from "../pcColors.js";

const token = (id: string, color: unknown): Token =>
  ({ id, owner: "u", x: 0, y: 0, color }) as Token;
const pc = (id: string, tokenId: string | null, extra: Partial<SnapshotCharacter> = {}) =>
  ({ id, name: id, type: "pc", tokenId, ...extra }) as SnapshotCharacter;
const waiting = (tokens: unknown[]): SceneState => ({ tokens }) as unknown as SceneState;

describe("withPcColors", () => {
  it("gives each PC its token's colour, as a clone", () => {
    const hero = pc("hero", "t1");
    const [out] = withPcColors([hero], new Map([["t1", "#aabbcc"]]));
    expect(out).toMatchObject({ id: "hero", color: "#aabbcc" });
    expect(out).not.toBe(hero);
    expect(hero).not.toHaveProperty("color");
  });

  it("leaves NPCs and token-less PCs as they are", () => {
    const goblin = { ...pc("gob", "t1"), type: "npc" } as SnapshotCharacter;
    const loose = pc("loose", null);
    const out = withPcColors([goblin, loose], new Map([["t1", "#aabbcc"]]));
    expect(out[0]).toBe(goblin);
    expect(out[1]).toBe(loose);
  });

  it("replaces a stale colour and removes one whose token is gone", () => {
    const stale = pc("stale", "t1", { color: "#000000" });
    const orphan = pc("orphan", "gone", { color: "#000000" });
    const out = withPcColors([stale, orphan], new Map([["t1", "#aabbcc"]]));
    expect(out[0]!.color).toBe("#aabbcc");
    expect(out[1]).not.toHaveProperty("color");
    expect(orphan.color).toBe("#000000");
  });
});

describe("loosePcColours", () => {
  const owned = (id: string, owner: string, color: unknown): Token =>
    ({ id, owner, x: 0, y: 0, color }) as Token;
  const roomWith = (tokens: Token[], characters: Partial<Character>[]) => {
    const state = createEmptyRoomState();
    state.tokens = tokens;
    state.characters = characters as Character[];
    return state;
  };

  it("colours a player's only, unlinked PC from the one token they own that nobody claims", () => {
    const state = roomWith(
      [owned("t-loose", "bo", "#8a2be2"), owned("t-gob", "bo", "#ff0000")],
      [
        { id: "old", type: "pc", ownedByPlayerUID: "bo", tokenId: null },
        { id: "gob", type: "npc", ownedByPlayerUID: "bo", tokenId: "t-gob" },
      ],
    );
    expect([...loosePcColours(state)]).toEqual([["old", "#8a2be2"]]);
    // On the record, so every screen gets it whatever its fog shows.
    const [out] = withPcColors([pc("old", null)], pcTokenColours(state), loosePcColours(state));
    expect(out!.color).toBe("#8a2be2");
  });

  it("guesses nothing: two loose tokens, a second PC, or no owner", () => {
    const twoLoose = roomWith(
      [owned("a", "bo", "#111111"), owned("b", "bo", "#222222")],
      [{ id: "old", type: "pc", ownedByPlayerUID: "bo", tokenId: null }],
    );
    const twoPcs = roomWith(
      [owned("a", "bo", "#111111"), owned("t2", "bo", "#445566")],
      [
        { id: "old", type: "pc", ownedByPlayerUID: "bo", tokenId: null },
        { id: "new", type: "pc", ownedByPlayerUID: "bo", tokenId: "t2" },
      ],
    );
    const ownerless = roomWith(
      [owned("a", "bo", "#111111")],
      [{ id: "old", type: "pc", tokenId: null }],
    );
    expect(loosePcColours(twoLoose).size).toBe(0);
    expect(loosePcColours(twoPcs).size).toBe(0);
    expect(loosePcColours(ownerless).size).toBe(0);
  });

  it("reads a DM's loose token as a player's, whether or not they are in DM mode", () => {
    // ensureToken links that very token to the PC at the DM's next join, so a rule
    // keyed on DM mode would only make the colour flicker on every screen.
    const state = roomWith(
      [owned("t-loose", "dm", "#8a2be2")],
      [{ id: "dm-pc", type: "pc", ownedByPlayerUID: "dm", tokenId: null }],
    );
    state.players = [{ uid: "dm", name: "DM", isDM: true }] as typeof state.players;
    expect([...loosePcColours(state)]).toEqual([["dm-pc", "#8a2be2"]]);
    state.players = [{ uid: "dm", name: "DM", isDM: false }] as typeof state.players;
    expect([...loosePcColours(state)]).toEqual([["dm-pc", "#8a2be2"]]);
  });

  it("is not used for a linked PC, whose own token's colour wins", () => {
    const [out] = withPcColors(
      [pc("hero", "t1")],
      new Map([["t1", "#aabbcc"]]),
      new Map([["hero", "#000000"]]),
    );
    expect(out!.color).toBe("#aabbcc");
  });
});

describe("pcTokenColours", () => {
  const stateWith = (
    tokens: Token[],
    characters: Partial<Character>[],
    scenes: Record<string, SceneState> = {},
  ) => {
    const state = createEmptyRoomState();
    state.tokens = tokens;
    state.characters = characters as Character[];
    state.sceneStates = scenes;
    return state;
  };

  it("reads each PC's token on this map, and nothing for NPCs", () => {
    const state = stateWith(
      [token("t-pc", "#112233"), token("t-npc", "#445566")],
      [
        { id: "pc", type: "pc", tokenId: "t-pc" },
        { id: "npc", type: "npc", tokenId: "t-npc" },
      ],
    );
    expect([...pcTokenColours(state)]).toEqual([["t-pc", "#112233"]]);
  });

  it("keeps the live copy when a token is both on this map and waiting with another", () => {
    const state = stateWith([token("t1", "#ff8800")], [{ id: "pc", type: "pc", tokenId: "t1" }], {
      elsewhere: waiting([token("t1", "#0088ff")]),
    });
    expect(pcTokenColours(state).get("t1")).toBe("#ff8800");
  });

  it("looks for a PC's token with another map only when it is missing here", () => {
    const state = stateWith([], [{ id: "pc", type: "pc", tokenId: "t1" }], {
      elsewhere: waiting([token("t1", "#0088ff")]),
    });
    expect(pcTokenColours(state).get("t1")).toBe("#0088ff");
  });

  it("skips colours that are not strings, empty ones, and malformed waiting entries", () => {
    const state = stateWith(
      [token("t-num", 7), token("t-undef", undefined), token("t-empty", "")],
      [
        { id: "a", type: "pc", tokenId: "t-num" },
        { id: "b", type: "pc", tokenId: "t-undef" },
        { id: "c", type: "pc", tokenId: "t-empty" },
        { id: "d", type: "pc", tokenId: "t-gone" },
      ],
      { broken: waiting([null, { id: 5 }, token("t-gone", { not: "a colour" })]) },
    );
    expect(pcTokenColours(state).size).toBe(0);
  });
});
