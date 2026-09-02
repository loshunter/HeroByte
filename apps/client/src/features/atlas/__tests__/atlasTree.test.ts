import { describe, expect, it } from "vitest";
import type { AtlasNodeSnapshot } from "@herobyte/shared";
import { atlasTreeRows } from "../atlasTree";

function node(id: string, overrides: Partial<AtlasNodeSnapshot> = {}): AtlasNodeSnapshot {
  return { id, kind: "dungeon", name: `name-${id}`, discovered: true, ...overrides };
}

describe("atlasTreeRows", () => {
  it("orders roots and children with depth, siblings by name", () => {
    const rows = atlasTreeRows([
      node("b-child", { parentId: "root", name: "Beta" }),
      node("root", { name: "World" }),
      node("a-child", { parentId: "root", name: "Alpha" }),
      node("grand", { parentId: "a-child", name: "Deep" }),
    ]);
    expect(rows.map((row) => `${row.depth}:${row.node.id}`)).toEqual([
      "0:root",
      "1:a-child",
      "2:grand",
      "1:b-child",
    ]);
  });

  it("renders an orphan at the root — a hidden parent is the projection's normal output", () => {
    const rows = atlasTreeRows([node("orphan", { parentId: "not-in-the-list" })]);
    expect(rows).toEqual([{ node: expect.objectContaining({ id: "orphan" }), depth: 0 }]);
  });

  it("breaks a cycle instead of recursing forever, and still renders every node", () => {
    const rows = atlasTreeRows([
      node("a", { parentId: "b" }),
      node("b", { parentId: "a" }),
      node("c", { parentId: "a" }),
    ]);
    expect(rows.map((row) => row.node.id).sort()).toEqual(["a", "b", "c"]);
  });
});
