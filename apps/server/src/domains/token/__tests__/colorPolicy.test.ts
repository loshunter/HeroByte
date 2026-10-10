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
      character({ id: "npc", type: "npc", ownedByPlayerUID: "cy", tokenId: "t-npc" }),
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

  it("never refuses because the clock stepped backwards", () => {
    let now = 50_000;
    const budget = new ColorWriteBudget(2, 1, () => now);
    budget.take("a");
    now = 40_000;
    expect(budget.take("a")).toBe(true);
  });

  it("forgets players who are back at a full budget once it holds many", () => {
    let now = 0;
    const budget = new ColorWriteBudget(1, 1, () => now);
    for (let player = 0; player < 300; player += 1) budget.take(`p${player}`);
    expect(budget.size).toBe(300);
    now = 5_000;
    budget.take("late");
    expect(budget.size).toBeLessThan(10);
  });
});
