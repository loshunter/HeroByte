/**
 * Every server broadcast delivers a fresh `npc` object, even when nothing about
 * this NPC changed (a player moved a token; a die was rolled). The editor
 * re-synced its fields on that object's identity, so a half-typed name or HP
 * was wiped by unrelated table activity. It re-syncs on the NPC's VALUES now.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { NPCEditor } from "../NPCEditor";

const npc = {
  id: "npc-1",
  name: "Baker",
  type: "npc",
  hp: 6,
  maxHp: 6,
} as SnapshotCharacter;

function renderEditor() {
  const handlers = { onUpdate: vi.fn(), onPlace: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() };
  const view = render(<NPCEditor npc={{ ...npc }} {...handlers} />);
  const rerenderWith = (next: Partial<SnapshotCharacter>) =>
    view.rerender(<NPCEditor npc={{ ...npc, ...next } as SnapshotCharacter} {...handlers} />);
  return { rerenderWith };
}

describe("NPCEditor — typed input survives unrelated broadcasts", () => {
  it("keeps a half-typed name and HP when a broadcast brings the same NPC", () => {
    const { rerenderWith } = renderEditor();
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    const hp = screen.getByLabelText("HP") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Boss" } });
    fireEvent.change(hp, { target: { value: "3" } });

    rerenderWith({}); // a fresh object, nothing about this NPC changed

    expect(name.value).toBe("Boss");
    expect(hp.value).toBe("3");
  });

  it("still takes a value the server changed", () => {
    const { rerenderWith } = renderEditor();
    const name = screen.getByLabelText("Name") as HTMLInputElement;

    rerenderWith({ name: "Baker the Bold" });

    expect(name.value).toBe("Baker the Bold");
  });
});
