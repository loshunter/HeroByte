/**
 * The Stance control, at both levels: the select's own contract, and the
 * editor's optimistic copy of it.
 *
 * The optimism is the whole point of the control — rendering straight off the
 * snapshot greyed the select out still showing the OLD stance for the round
 * trip, which reads as "my click did not take". What that optimism has to
 * survive is the resync effect underneath it, which is keyed on an object the
 * server hands back fresh on EVERY broadcast.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { NPCEditor } from "../NPCEditor";
import { NpcStanceSelect } from "../NpcStanceSelect";

const BASE = { id: "npc-1", name: "Old Marta", type: "npc", hp: 7, maxHp: 9 } as SnapshotCharacter;

/** A fresh object every time, the way a deserialized snapshot hands it over. */
const snapshotNpc = (over: Partial<SnapshotCharacter> = {}) =>
  ({ ...BASE, ...over }) as SnapshotCharacter;

function renderEditor(npc: SnapshotCharacter, isUpdating = false) {
  const onUpdate = vi.fn();
  const view = render(
    <NPCEditor
      npc={npc}
      onUpdate={onUpdate}
      onPlace={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      isUpdating={isUpdating}
    />,
  );
  const rerender = (next: SnapshotCharacter, updating = false) =>
    view.rerender(
      <NPCEditor
        npc={next}
        onUpdate={onUpdate}
        onPlace={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        isUpdating={updating}
      />,
    );
  return { onUpdate, rerender, stance: screen.getByLabelText("Stance") as HTMLSelectElement };
}

describe("NpcStanceSelect", () => {
  it("shows the three labels, defaults an absent stance to Enemy, and disables", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NpcStanceSelect onChange={onChange} />);
    const select = screen.getByLabelText("Stance") as HTMLSelectElement;
    // Absent means hostile on the wire, in both load doors and on the card.
    expect(select.value).toBe("hostile");
    expect([...select.options].map((o) => o.textContent)).toEqual(["Enemy", "Neutral", "Ally"]);
    expect(select.disabled).toBe(false);

    // A VALUE, not the caller's partial-update record.
    fireEvent.change(select, { target: { value: "friendly" } });
    expect(onChange).toHaveBeenCalledWith("friendly");

    rerender(<NpcStanceSelect value="neutral" disabled onChange={onChange} />);
    expect(select.value).toBe("neutral");
    expect(select.disabled).toBe(true);
  });
});

describe("NPCEditor — Stance", () => {
  it("shows the DM's choice at once and commits it, keeping the rest of the fields", () => {
    const { onUpdate, stance } = renderEditor(snapshotNpc());
    expect(stance.value).toBe("hostile");

    fireEvent.change(stance, { target: { value: "friendly" } });
    expect(stance.value).toBe("friendly");
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Old Marta", hp: 7, maxHp: 9, disposition: "friendly" }),
    );
  });

  it("an unrelated broadcast mid-flight does not put the old stance back", () => {
    // THE BUG: `npc` is a new object on every snapshot, so the resync effect
    // fired on a player moving a token or a die being rolled — not only on
    // the reply being waited for. It reverted the select, greyed out, to the
    // word the DM had just changed, which is exactly the "my click did not
    // take" the optimism exists to remove; the server's snapshot then flipped
    // it back a moment later.
    const { rerender, stance } = renderEditor(snapshotNpc());
    fireEvent.change(stance, { target: { value: "friendly" } });
    expect(stance.value).toBe("friendly");

    // The send is in flight. Someone else moves a token: a whole new snapshot
    // arrives, carrying this NPC unchanged.
    rerender(snapshotNpc(), true);
    expect(stance.value).toBe("friendly");

    // And the confirmation, which is what clears isUpdating: the snapshot now
    // MATCHES, so the resync runs and agrees.
    rerender(snapshotNpc({ disposition: "friendly" }), false);
    expect(stance.value).toBe("friendly");
  });

  it("still resyncs when nothing is in flight, so another DM's change lands", () => {
    // The guard must not become "never resync": a co-DM setting the stance,
    // or an update that timed out, has to reach the select.
    const { rerender, stance } = renderEditor(snapshotNpc({ disposition: "friendly" }));
    expect(stance.value).toBe("friendly");

    rerender(snapshotNpc({ disposition: "neutral" }));
    expect(stance.value).toBe("neutral");
    rerender(snapshotNpc());
    expect(stance.value).toBe("hostile");
  });

  it("keeps a half-typed name through the same unrelated broadcast", () => {
    // The clobber was never stance-only; the guard covers the whole resync.
    const { rerender } = renderEditor(snapshotNpc());
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Old Marta the innkeep" } });

    rerender(snapshotNpc(), true);
    expect(name.value).toBe("Old Marta the innkeep");
  });
});
