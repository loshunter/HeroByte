/**
 * Temp HP leaves the editor as a NUMBER, 0 included.
 *
 * 5a152d8a made the server store tempHp; the editor still sent
 * `parsedTempHp > 0 ? parsedTempHp : undefined`, and useNpcUpdate merges an
 * absent field from the existing record — so "0" went out as the old value,
 * the server kept it, the snapshot confirmed it, and the box resynced to it.
 * A DM could set Temp HP and never clear it, with a success path.
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
  tempHp: 5,
} as SnapshotCharacter;

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
  return { onUpdate, tempHp: screen.getByLabelText("Temp HP") as HTMLInputElement };
}

/**
 * The VALUE the last commit carried for tempHp. The editor always emits the
 * key (`undefined` when it has nothing to say), and every consumer treats an
 * undefined value as absent — JSON.stringify drops it, useNpcUpdate merges
 * with `??`, the server guards `!== undefined` — so the value is the oracle,
 * exactly as the characterization suite's own `toHaveBeenCalledWith` sees it.
 */
const lastSent = (onUpdate: ReturnType<typeof vi.fn>) =>
  (onUpdate.mock.lastCall![0] as Record<string, unknown>).tempHp;

describe("NPCEditor — Temp HP", () => {
  it("sends the number typed, and sends 0 to CLEAR rather than omitting it", () => {
    const { onUpdate, tempHp } = renderEditor();
    expect(tempHp.value).toBe("5");

    fireEvent.change(tempHp, { target: { value: "7" } });
    fireEvent.blur(tempHp);
    expect(lastSent(onUpdate)).toBe(7);

    // The dead-end: 0 used to go out as undefined, which the merge filled
    // from the existing 5.
    fireEvent.change(tempHp, { target: { value: "0" } });
    fireEvent.blur(tempHp);
    expect(lastSent(onUpdate)).toBe(0);
  });

  it("an NPC with NO temp HP keeps sending none for 0 — every edit must not stamp tempHp: 0", () => {
    // The first cut of this fix sent 0 unconditionally, which broke sixteen
    // characterization assertions on the exact payload and would have written
    // `tempHp: 0` onto every NPC record the DM ever blurred a field on. The
    // characterization suite was right. 0 goes out only when there is a
    // value to clear.
    const { onUpdate, tempHp } = renderEditor({ tempHp: undefined });
    expect(tempHp.value).toBe("0");

    fireEvent.change(tempHp, { target: { value: "0" } });
    fireEvent.blur(tempHp);
    expect(lastSent(onUpdate)).toBeUndefined();

    // …and setting one from nothing still goes out.
    fireEvent.change(tempHp, { target: { value: "4" } });
    fireEvent.blur(tempHp);
    expect(lastSent(onUpdate)).toBe(4);
  });

  it("an emptied box and a negative both clear to 0, never to absent", () => {
    const { onUpdate, tempHp } = renderEditor();

    fireEvent.change(tempHp, { target: { value: "" } });
    fireEvent.blur(tempHp);
    expect(lastSent(onUpdate)).toBe(0);

    // The old `> 0` guard also masked a negative as absent; the clamp at
    // parse time is what keeps it from reaching the validator now.
    fireEvent.change(tempHp, { target: { value: "-3" } });
    fireEvent.blur(tempHp);
    expect(lastSent(onUpdate)).toBe(0);
  });
});
