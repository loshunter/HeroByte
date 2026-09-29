// The server refuses an NPC name over 50 characters (`update-npc`), and a
// refused whole-record send used to ride every later Party edit of that NPC.
// Both NPC name inputs stop at the server's limit instead of offering a name
// that can only fail. (A player character's name allows 100.)

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { NpcNameEditor } from "../NpcNameEditor";
import { NPCEditor } from "../../../dm/components/NPCEditor";
import { NPC_NAME_MAX } from "../../npcUpdate";

describe("NPC name inputs stop at the server's limit", () => {
  it("the limit is the server's: 50", () => {
    expect(NPC_NAME_MAX).toBe(50);
  });

  it("the Party card's inline editor", () => {
    render(<NpcNameEditor id="npc-1" name="Goblin" canEdit onRename={vi.fn()} />);
    fireEvent.click(screen.getByText("Goblin"));

    expect(screen.getByDisplayValue("Goblin")).toHaveAttribute("maxLength", "50");
  });

  it("the DM menu's editor", () => {
    const npc = { id: "npc-1", name: "Baker", type: "npc", hp: 6, maxHp: 6 } as SnapshotCharacter;
    render(
      <NPCEditor
        npc={npc}
        onUpdate={vi.fn()}
        onPlace={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveAttribute("maxLength", "50");
  });
});
