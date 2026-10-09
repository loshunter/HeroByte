import { describe, expect, it } from "vitest";
import type { SnapshotCharacter, Token } from "@herobyte/shared";
import { withPcColors } from "../pcColors.js";

const token = (id: string, color: string): Token => ({ id, owner: "u", x: 0, y: 0, color });
const pc = (id: string, tokenId: string | null, extra: Partial<SnapshotCharacter> = {}) =>
  ({ id, name: id, type: "pc", tokenId, ...extra }) as SnapshotCharacter;

describe("withPcColors", () => {
  it("gives each PC its token's colour, as a clone", () => {
    const hero = pc("hero", "t1");
    const [out] = withPcColors([hero], [token("t1", "#aabbcc")]);
    expect(out).toMatchObject({ id: "hero", color: "#aabbcc" });
    expect(out).not.toBe(hero);
    expect(hero).not.toHaveProperty("color");
  });

  it("leaves NPCs and token-less PCs as they are", () => {
    const goblin = { ...pc("gob", "t1"), type: "npc" } as SnapshotCharacter;
    const loose = pc("loose", null);
    const out = withPcColors([goblin, loose], [token("t1", "#aabbcc")]);
    expect(out[0]).toBe(goblin);
    expect(out[1]).toBe(loose);
  });

  it("replaces a stale colour and removes one whose token is gone", () => {
    const stale = pc("stale", "t1", { color: "#000000" });
    const orphan = pc("orphan", "gone", { color: "#000000" });
    const out = withPcColors([stale, orphan], [token("t1", "#aabbcc")]);
    expect(out[0]!.color).toBe("#aabbcc");
    expect(out[1]).not.toHaveProperty("color");
    expect(orphan.color).toBe("#000000");
  });
});
