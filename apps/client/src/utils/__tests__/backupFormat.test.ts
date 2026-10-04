// The sniffer is the keystone of the wrong-file work, and until now every
// assertion on it was second-hand through its two callers. That is how two
// sub-clauses of the thin-map arm ended up unpinned: deleting the `id` check,
// or the `schemaVersion` check beside it, left all three caller suites green
// while the comment above them described exactly what breaks.
//
// A truth table, directly on the function. Rules are ordered, so the cases that
// matter most are the ones that could fall through to the wrong arm.
import { describe, it, expect } from "vitest";
import { detectBackupFormat } from "../backupFormat";

describe("detectBackupFormat", () => {
  it.each([
    // Session: the envelope, and the bare snapshot older saves wrote.
    [{ snapshot: {} }, "session"],
    [{ tokens: [], players: [] }, "session"],
    // One collection is not enough — plenty of unrelated JSON has `tokens`.
    [{ tokens: [] }, "unknown"],
    [{ players: [] }, "unknown"],
    // Map: the full shape, at any version (the version is the caller's to judge).
    [{ name: "Dungeon", layers: [], elements: [] }, "map"],
    [{ schemaVersion: 2, name: "Dungeon", layers: [], elements: [] }, "map"],
    // …but BOTH collections make a document a map: a name and one of them is not enough.
    [{ name: "Dungeon", layers: [] }, "unknown"],
    [{ name: "Dungeon", elements: [] }, "unknown"],
    // Map: the thin shape the importer deliberately accepts.
    [{ schemaVersion: 1, id: "doc-A", name: "Dungeon" }, "map"],
    // …and the two ways it must NOT match. Without the id, arbitrary JSON gets
    // sent to Map Studio, which accepts it and ships it to a server that
    // refuses it. Without the version, anything with a name qualifies.
    [{ schemaVersion: 1, name: "anything" }, "unknown"],
    [{ id: "doc-A", name: "Dungeon" }, "unknown"],
    [{ schemaVersion: 2, id: "doc-A", name: "Dungeon" }, "unknown"],
    // Character (Save character): a name and BOTH HP numbers, nothing of a table or a map.
    [{ name: "Aria", hp: 30, maxHp: 40 }, "character"],
    [{ name: "Aria", hp: 30, maxHp: 40, token: { id: "tok-1" }, drawings: [] }, "character"],
    // …and the ways it must NOT match: a name alone, one HP, HP as text.
    [{ name: "Aria" }, "unknown"],
    [{ name: "Aria", hp: 30 }, "unknown"],
    [{ name: "Aria", hp: "30", maxHp: "40" }, "unknown"],
    [{ hp: 30, maxHp: 40 }, "unknown"],
    // Not objects at all. `null` is the one that used to throw.
    [null, "unknown"],
    [5, "unknown"],
    ["hi", "unknown"],
    [[], "unknown"],
  ])("%j -> %s", (input, expected) => {
    expect(detectBackupFormat(input)).toBe(expected);
  });

  it("never takes a table or a map for a character, whatever else they carry", () => {
    // The character rule is asked LAST, so the two files that can lose data when
    // refused are matched first — a table backup must restore, a map must import.
    expect(detectBackupFormat({ snapshot: {}, name: "Aria", hp: 30, maxHp: 40 })).toBe("session");
    expect(
      detectBackupFormat({ name: "Dungeon", layers: [], elements: [], hp: 30, maxHp: 40 }),
    ).toBe("map");
  });

  it("classifies a session envelope as a session even when it also looks map-shaped", () => {
    // Order matters: the session rules run first on purpose, so a save can
    // never be refused as a map. This is the data-loss-shaped case.
    const hostile = { schemaVersion: 1, id: "doc-A", name: "Dungeon", snapshot: {} };
    expect(detectBackupFormat(hostile)).toBe("session");
  });
});
