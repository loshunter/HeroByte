// What an NPC edit sends to clear a field. `update-npc` is a whole record and
// the merge refills any undefined field with the value the NPC already has, so
// a clear must be explicit — and an NPC with nothing to clear must not gain an
// explicit empty value from an unrelated edit. Both NPC editors send through
// these two rules.

import { describe, expect, it } from "vitest";
import { tempHpEdit, tokenImageEdit } from "../npcUpdate";

describe("tempHpEdit", () => {
  it("sends the value typed", () => {
    expect(tempHpEdit(7, undefined)).toBe(7);
    expect(tempHpEdit(7, 5)).toBe(7);
  });

  it("sends 0 to clear temp HP the NPC has", () => {
    expect(tempHpEdit(0, 5)).toBe(0);
    expect(tempHpEdit(0, 0)).toBe(0);
  });

  it("sends none for an NPC with none", () => {
    expect(tempHpEdit(0, undefined)).toBeUndefined();
  });
});

describe("tokenImageEdit", () => {
  it("sends the url, trimmed", () => {
    expect(tokenImageEdit("  x.png ", null)).toBe("x.png");
  });

  it('sends "" to clear art on file', () => {
    expect(tokenImageEdit("", "x.png")).toBe("");
    expect(tokenImageEdit("   ", "x.png")).toBe("");
  });

  it("sends none for an NPC with no art", () => {
    expect(tokenImageEdit("", null)).toBeUndefined();
    expect(tokenImageEdit("", undefined)).toBeUndefined();
    expect(tokenImageEdit("", "")).toBeUndefined();
  });
});
