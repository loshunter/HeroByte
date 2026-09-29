/**
 * Clearing an NPC's token art leaves the editor as "", not as undefined.
 *
 * `update-npc` is a whole-record send, and useNpcUpdate's merge fills an
 * undefined field from the NPC's current record — so an emptied Token Image
 * went out as the OLD url, the server kept it, and the map kept the art while
 * the field read empty. The server stores `tokenImage?.trim() || null`, so ""
 * is the clear. Same trap Temp HP had (NPCEditor.tempHp.test.tsx).
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { NPCEditor } from "../NPCEditor";

const npc = { id: "npc-1", name: "Baker", type: "npc", hp: 6, maxHp: 6 } as SnapshotCharacter;

function renderEditor(over: Partial<SnapshotCharacter> = {}) {
  const onUpdate = vi.fn();
  render(
    <NPCEditor
      npc={{ ...npc, ...over } as SnapshotCharacter}
      onUpdate={onUpdate}
      onPlace={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return { onUpdate, field: screen.getByLabelText("Token Image URL") as HTMLInputElement };
}

const lastSent = (onUpdate: ReturnType<typeof vi.fn>) =>
  (onUpdate.mock.lastCall![0] as Record<string, unknown>).tokenImage;

describe("NPCEditor — clearing Token Image", () => {
  it("sends an empty tokenImage when the art on file is cleared", async () => {
    const { onUpdate, field } = renderEditor({ tokenImage: "https://example.test/x.png" });
    expect(field.value).toBe("https://example.test/x.png");

    fireEvent.change(field, { target: { value: "" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(lastSent(onUpdate)).toBe("");
  });

  it("an NPC with no art keeps sending none — an edit must not stamp a clear", () => {
    const { onUpdate } = renderEditor({ tokenImage: null });

    const hp = screen.getByLabelText("HP") as HTMLInputElement;
    fireEvent.change(hp, { target: { value: "4" } });
    fireEvent.blur(hp);

    expect(onUpdate).toHaveBeenCalled();
    expect(lastSent(onUpdate)).toBeUndefined();
  });
});
