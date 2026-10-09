import { describe, expect, it } from "vitest";
import type { Character, Token } from "@herobyte/shared";
import { createEmptyRoomState } from "../../room/model.js";
import { ColorWriteBudget, pcColorHolders } from "../colorPolicy.js";

const token = (id: string, owner: string, color: string): Token => ({
  id,
  owner,
  x: 0,
  y: 0,
  color,
});
const character = (fields: Partial<Character> & { id: string }): Character =>
  ({ name: fields.id, hp: 5, maxHp: 5, type: "pc", tokenId: null, ...fields }) as Character;

describe("pcColorHolders", () => {
  it("holds one colour per owned, visible PC with a token, and nothing else", () => {
    const state = createEmptyRoomState();
    state.tokens = [
      token("t-pc", "ann", "#112233"),
      token("t-npc", "cy", "#445566"),
      token("t-orphan", "lost", "#778899"),
      token("t-hidden", "ghost", "#aabbcc"),
    ];
    state.characters = [
      character({ id: "pc", ownedByPlayerUID: "ann", tokenId: "t-pc" }),
      // A claimed NPC: its token belongs to a player, and it still holds nothing.
      character({ id: "npc", type: "npc", ownedByPlayerUID: undefined, tokenId: "t-npc" }),
      character({ id: "orphan", ownedByPlayerUID: undefined, tokenId: "t-orphan" }),
      character({
        id: "hidden",
        ownedByPlayerUID: "ghost",
        tokenId: "t-hidden",
        visibleToPlayers: false,
      }),
      character({ id: "tokenless", ownedByPlayerUID: "bo", tokenId: null }),
    ];
    expect(pcColorHolders(state).map((holder) => holder.characterId)).toEqual(["pc"]);
  });
});

describe("ColorWriteBudget", () => {
  it("allows a burst, then refills at its rate, per player", () => {
    let now = 0;
    const budget = new ColorWriteBudget(3, 2, () => now);
    expect([1, 2, 3, 4].map(() => budget.take("a"))).toEqual([true, true, true, false]);
    expect(budget.take("b")).toBe(true);
    now = 499;
    expect(budget.take("a")).toBe(false);
    now = 500;
    expect(budget.take("a")).toBe(true);
    now = 10_000;
    expect([1, 2, 3, 4].map(() => budget.take("a"))).toEqual([true, true, true, false]);
  });
});
