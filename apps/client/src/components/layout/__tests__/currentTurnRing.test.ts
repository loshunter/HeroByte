// The current-turn cue must not collide with the DM card's own gold border:
// since F3 a DM's rolled character stands in the order beside the players',
// and PlayerCard gives a DM's card `2px solid var(--jrpg-gold)` of its own.
// jsdom loads no stylesheet, so the rule is read from the file.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("the current-turn ring", () => {
  it("is a WHITE ring (3px) in the gold glow — distinct from a DM card's gold border", () => {
    const css = readFileSync(resolve(__dirname, "../../../theme/herobyte.css"), "utf8");
    const rule = css.match(/\.player-card-shell--current-turn\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/border:\s*3px solid var\(--jrpg-white\)/);
    expect(rule).toMatch(/box-shadow:\s*0 0 20px rgba\(255, 215, 0, 0\.6\)/);
    expect(rule).not.toMatch(/border:[^;]*--jrpg-gold/);
  });
});
