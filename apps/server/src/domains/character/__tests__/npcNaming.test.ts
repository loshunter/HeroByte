/**
 * Tests for NPC name allocation (S8).
 *
 * The rule these pin: adding five goblins and then three more must give
 * Goblin 1–8, not two overlapping sets. "Tell Goblin 3 from Goblin 5" is the
 * whole reason the feature exists, so handing back duplicates would defeat it.
 */

import { describe, it, expect } from "vitest";
import { allocateNpcNames, splitNumberedName } from "../npcNaming.js";

describe("splitNumberedName", () => {
  it("splits a trailing integer off the base", () => {
    expect(splitNumberedName("Goblin 3")).toEqual({ base: "Goblin", index: 3 });
    expect(splitNumberedName("Ancient Red Dragon 12")).toEqual({
      base: "Ancient Red Dragon",
      index: 12,
    });
  });

  it("leaves an unnumbered name alone", () => {
    expect(splitNumberedName("Goblin")).toEqual({ base: "Goblin" });
    expect(splitNumberedName("  Goblin  ")).toEqual({ base: "Goblin" });
  });

  it("does not treat a padded or non-canonical number as an index", () => {
    // "Goblin 007" is a name. Parsing it would silently rewrite it as "Goblin 8".
    expect(splitNumberedName("Goblin 007")).toEqual({ base: "Goblin 007" });
  });

  it("does not mistake an interior number for an index", () => {
    expect(splitNumberedName("Level 3 Wizard")).toEqual({ base: "Level 3 Wizard" });
  });
});

describe("allocateNpcNames", () => {
  it("leaves a single free name exactly as typed", () => {
    // This is what keeps the plain "+ Add NPC" button's behaviour identical.
    expect(allocateNpcNames([], "New NPC", 1)).toEqual(["New NPC"]);
    expect(allocateNpcNames(["Goblin"], "Orc", 1)).toEqual(["Orc"]);
  });

  it("numbers from 1 when asked for several", () => {
    expect(allocateNpcNames([], "Goblin", 5)).toEqual([
      "Goblin 1",
      "Goblin 2",
      "Goblin 3",
      "Goblin 4",
      "Goblin 5",
    ]);
  });

  it("continues past names that already exist", () => {
    const existing = ["Goblin 1", "Goblin 2", "Goblin 3", "Goblin 4", "Goblin 5"];
    expect(allocateNpcNames(existing, "Goblin", 3)).toEqual(["Goblin 6", "Goblin 7", "Goblin 8"]);
  });

  it("treats a bare name as number 1, so a duplicate becomes 2", () => {
    expect(allocateNpcNames(["Goblin"], "Goblin", 1)).toEqual(["Goblin 2"]);
  });

  it("continues an existing series when duplicating a numbered NPC", () => {
    // Duplicating "Goblin 3" must not produce "Goblin 3 2".
    expect(allocateNpcNames(["Goblin 1", "Goblin 2", "Goblin 3"], "Goblin 3", 1)).toEqual([
      "Goblin 4",
    ]);
  });

  it("keeps separate base names in separate series", () => {
    const existing = ["Goblin 1", "Goblin 2", "Orc 1"];
    expect(allocateNpcNames(existing, "Orc", 2)).toEqual(["Orc 2", "Orc 3"]);
  });

  it("never collides within a single batch", () => {
    const names = allocateNpcNames([], "Goblin", 20);
    expect(new Set(names).size).toBe(20);
  });

  it("never returns a name that already exists", () => {
    // A gap in the series must not be back-filled into a collision.
    const existing = ["Goblin 1", "Goblin 4"];
    const allocated = allocateNpcNames(existing, "Goblin", 3);
    expect(allocated).toEqual(["Goblin 5", "Goblin 6", "Goblin 7"]);
    for (const name of allocated) {
      expect(existing).not.toContain(name);
    }
  });

  it("continues past the HIGHEST in the series, not just past the source", () => {
    // Duplicating "Goblin 7" while "Goblin 8" exists must give 9, not 8.
    expect(allocateNpcNames(["Goblin 7", "Goblin 8"], "Goblin 7", 1)).toEqual(["Goblin 9"]);
  });

  it("clamps a nonsensical count to at least one", () => {
    expect(allocateNpcNames([], "Goblin", 0)).toHaveLength(1);
    expect(allocateNpcNames([], "Goblin", -5)).toHaveLength(1);
    expect(allocateNpcNames([], "Goblin", 2.7)).toHaveLength(2);
  });

  it("survives a name that is only a number", () => {
    expect(allocateNpcNames([], "42", 1)).toEqual(["42"]);
    expect(allocateNpcNames(["42"], "42", 1)).toEqual(["42 2"]);
  });

  it("does not turn a whitespace-only name into no name at all", () => {
    // validateCreateNpcMessage admits " " (one character), and such a name was
    // stored verbatim before this function existed. Trimming it to "" would
    // render as a blank nameplate — strictly worse than the odd name asked for.
    expect(allocateNpcNames([], " ", 1)).toEqual([" "]);
    expect(allocateNpcNames([], "   ", 1)).toEqual(["   "]);
  });

  it("trims a name that has a usable base", () => {
    expect(allocateNpcNames([], "Goblin   ", 1)).toEqual(["Goblin"]);
    expect(allocateNpcNames(["Goblin"], "  Goblin  ", 1)).toEqual(["Goblin 2"]);
  });

  it("terminates when the series has reached the float64 integer ceiling", () => {
    // `next` would land on 2^53, where `next += 1` is a no-op — the candidate
    // never changes, the collision skip fires every pass, and the loop cannot
    // finish. This is not theoretical: update-npc stores a name verbatim, so a
    // DM can rename an NPC to "G 9007199254740991", and the next bulk add on
    // base "G" hangs the single process that serves every table.
    //
    // Removing the reset makes this return ONE name rather than hanging, which
    // is the whole point of the attempt ceiling beside it — a synchronous spin
    // blocks the event loop, so vitest could not have timed it out either.
    const names = allocateNpcNames(["G 9007199254740991"], "G", 2);

    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    expect(names).not.toContain("G 9007199254740991");
  }, 1000);

  it("skips numbers already in use after restarting at the ceiling", () => {
    // The restart walks back over low numbers, so the collision skip inside the
    // loop is genuinely reachable here — it was not before this guard existed.
    expect(allocateNpcNames(["G 9007199254740991", "G 1", "G 2"], "G", 2)).toEqual(["G 3", "G 4"]);
  }, 1000);

  it("still numbers normally one below the ceiling", () => {
    // Guards the fix against over-reach: just under the boundary the ordinary
    // "carry on from the highest" rule must be untouched.
    expect(allocateNpcNames(["G 9007199254740990"], "G", 2)).toEqual([
      "G 9007199254740991",
      "G 9007199254740992",
    ]);
  });
});
