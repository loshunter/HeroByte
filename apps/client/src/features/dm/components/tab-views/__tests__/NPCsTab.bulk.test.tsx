/**
 * Tests for the NPCs tab's bulk-add and duplicate controls (S8), and — since
 * the keyboard-movement arc — its speed field and movement-budget reset,
 * which must each name THEIR monster.
 *
 * These drive the REAL NPCsTab. The neighbouring characterization file
 * (components/__tests__/characterization/NPCsTab.test.tsx) re-declares the
 * component inline as a stub, so it cannot see a change to the shipped one —
 * which is exactly the kind of test that passes vacuously.
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { NPC_CREATE_LIMITS } from "@herobyte/shared";
import NPCsTab from "../NPCsTab";

afterEach(() => cleanup());

const npc = (id: string, name: string): SnapshotCharacter =>
  ({ id, name, type: "npc", hp: 10, maxHp: 10 }) as SnapshotCharacter;

function renderTabProps(overrides: Partial<React.ComponentProps<typeof NPCsTab>> = {}) {
  return {
    npcs: [] as SnapshotCharacter[],
    onCreateNPC: vi.fn(),
    onDuplicateNPC: vi.fn(),
    onUpdateNPC: vi.fn(),
    onSetNPCSpeed: vi.fn(),
    onResetNPCBudget: vi.fn(),
    combatActive: true,
    onPlaceNPCToken: vi.fn(),
    onDeleteNPC: vi.fn(),
    ...overrides,
  };
}

function renderTab(overrides: Partial<React.ComponentProps<typeof NPCsTab>> = {}) {
  const props = renderTabProps(overrides);
  render(<NPCsTab {...props} />);
  return props;
}

const countField = () => screen.getByLabelText(/how many npcs to add/i);
const addButton = () => screen.getByRole("button", { name: /\+ Add \d* ?NPCs?/i });

describe("NPCsTab — the speed field names ITS monster", () => {
  it("typing into the second editor sets the SECOND monster's speed", () => {
    // A one-NPC spec cannot see `npcs[0].id` wired in place of `npc.id`.
    const props = renderTab({ npcs: [npc("n1", "Goblin"), npc("n2", "Ogre")] });
    const fields = screen.getAllByLabelText("Movement speed in feet per turn");
    expect(fields).toHaveLength(2);
    fireEvent.change(fields[1]!, { target: { value: "40" } });
    fireEvent.blur(fields[1]!);
    expect(props.onSetNPCSpeed).toHaveBeenCalledTimes(1);
    expect(props.onSetNPCSpeed).toHaveBeenCalledWith("n2", 40);
  });

  it("the reset button names ITS monster too, reads its spend, and is inert with nothing spent", () => {
    const spent = { ...npc("n2", "Ogre"), initiative: 9, movementUsed: 15 } as SnapshotCharacter;
    const props = renderTab({
      npcs: [
        { ...npc("n1", "Goblin"), initiative: 4, movementUsed: 0 } as SnapshotCharacter,
        spent,
      ],
    });
    const resets = screen.getAllByRole("button", { name: "Reset movement budget" });
    expect(resets).toHaveLength(2);
    expect(resets[0]).toBeDisabled(); // the goblin has spent nothing
    expect(resets[1]).toBeEnabled();
    expect(screen.getByText("Used 15 ft")).toBeInTheDocument();
    fireEvent.click(resets[1]!);
    expect(props.onResetNPCBudget).toHaveBeenCalledTimes(1);
    expect(props.onResetNPCBudget).toHaveBeenCalledWith("n2");
  });

  it("no reset out of combat, for a monster not in the order, or whose spend the frame does not carry", () => {
    const spent = { ...npc("n2", "Ogre"), initiative: 9, movementUsed: 15 } as SnapshotCharacter;
    const { unmount } = render(
      <NPCsTab {...renderTabProps({ npcs: [spent], combatActive: false })} />,
    );
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    unmount();
    // Out of the order but with a spend: the server charged it, so the lever shows.
    renderTab({ npcs: [{ ...spent, initiative: undefined } as SnapshotCharacter] });
    expect(screen.getByRole("button", { name: "Reset movement budget" })).toBeEnabled();
    cleanup();
    renderTab({
      npcs: [{ ...spent, initiative: undefined, movementUsed: 0 } as SnapshotCharacter],
    });
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    cleanup();
    // The elevation blip: the frame is still the player's, no spend on it.
    renderTab({ npcs: [{ ...spent, movementUsed: undefined } as SnapshotCharacter] });
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });
});

describe("NPCsTab — adding several at once", () => {
  it("defaults to one and reads as the plain button", () => {
    renderTab();

    expect(countField()).toHaveValue(1);
    expect(screen.getByRole("button", { name: "+ Add NPC" })).toBeInTheDocument();
  });

  it("sends count 1 by default", () => {
    const props = renderTab();

    fireEvent.click(addButton());

    expect(props.onCreateNPC).toHaveBeenCalledWith({ count: 1 });
  });

  it("sends the typed count and says so on the button", () => {
    const props = renderTab();

    fireEvent.change(countField(), { target: { value: "5" } });
    expect(screen.getByRole("button", { name: "+ Add 5 NPCs" })).toBeInTheDocument();

    fireEvent.click(addButton());
    expect(props.onCreateNPC).toHaveBeenCalledWith({ count: 5 });
  });

  it("clamps above the shared ceiling rather than sending a rejectable count", () => {
    const props = renderTab();

    fireEvent.change(countField(), { target: { value: "999" } });
    fireEvent.click(addButton());

    expect(props.onCreateNPC).toHaveBeenCalledWith({ count: NPC_CREATE_LIMITS.COUNT_MAX });
  });

  it("shows the clamped total on the button while the field still reads what was typed", () => {
    // The field's own comment used to claim the blur snap meant it "can never
    // disagree with the button next to it". It can, in exactly this window:
    // `count` is clamped on every render but `countInput` is only reconciled on
    // blur. The BUTTON is the honest one — it is what the press will actually
    // do — so that is what this pins.
    renderTab();

    fireEvent.change(countField(), { target: { value: "99" } });

    expect(countField()).toHaveValue(99);
    expect(
      screen.getByRole("button", { name: `+ Add ${NPC_CREATE_LIMITS.COUNT_MAX} NPCs` }),
    ).toBeInTheDocument();

    fireEvent.blur(countField());
    expect(countField()).toHaveValue(NPC_CREATE_LIMITS.COUNT_MAX);
  });

  it("keeps the count across batches instead of resetting it", () => {
    // Sticky ON PURPOSE — a DM staging wave after wave should not retype it,
    // and the button label says "+ Add 5 NPCs" the whole time. Pinned because
    // it is a design choice made by omission, and the next reader would
    // otherwise be free to "fix" it.
    const props = renderTab();

    fireEvent.change(countField(), { target: { value: "5" } });
    fireEvent.click(addButton());
    fireEvent.click(addButton());

    expect(props.onCreateNPC).toHaveBeenCalledTimes(2);
    expect(props.onCreateNPC).toHaveBeenNthCalledWith(2, { count: 5 });
    expect(screen.getByRole("button", { name: "+ Add 5 NPCs" })).toBeInTheDocument();
  });

  it("clamps zero, negatives and junk up to one", () => {
    const props = renderTab();

    for (const value of ["0", "-4", "abc", ""]) {
      fireEvent.change(countField(), { target: { value } });
      fireEvent.click(addButton());
      expect(props.onCreateNPC).toHaveBeenLastCalledWith({ count: NPC_CREATE_LIMITS.COUNT_MIN });
    }
  });

  it("lets the field go empty mid-edit instead of fighting the cursor", () => {
    renderTab();

    fireEvent.change(countField(), { target: { value: "" } });
    expect(countField()).toHaveValue(null);
  });

  it("snaps the field to what will actually be sent, on blur", () => {
    renderTab();

    fireEvent.change(countField(), { target: { value: "999" } });
    fireEvent.blur(countField());

    expect(countField()).toHaveValue(NPC_CREATE_LIMITS.COUNT_MAX);
  });

  it("disables adding while a create is in flight", () => {
    renderTab({ isCreatingNpc: true });

    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });
});

describe("NPCsTab — duplicating", () => {
  it("offers a duplicate button on every NPC", () => {
    renderTab({ npcs: [npc("a", "Goblin 1"), npc("b", "Orc")] });

    expect(screen.getAllByRole("button", { name: /duplicate/i })).toHaveLength(2);
  });

  it("duplicates the NPC it belongs to", () => {
    const props = renderTab({ npcs: [npc("a", "Goblin 1"), npc("b", "Orc")] });

    const orcCard = screen.getByDisplayValue("Orc").closest("div[class]") as HTMLElement;
    fireEvent.click(within(orcCard).getByRole("button", { name: /duplicate/i }));

    expect(props.onDuplicateNPC).toHaveBeenCalledTimes(1);
    expect(props.onDuplicateNPC).toHaveBeenCalledWith("b");
  });

  it("does not place or delete when duplicating", () => {
    const props = renderTab({ npcs: [npc("a", "Goblin 1")] });

    fireEvent.click(screen.getByRole("button", { name: /duplicate/i }));

    expect(props.onPlaceNPCToken).not.toHaveBeenCalled();
    expect(props.onDeleteNPC).not.toHaveBeenCalled();
  });

  it("disables duplicate while a create is in flight", () => {
    renderTab({ npcs: [npc("a", "Goblin 1")], isCreatingNpc: true });

    expect(screen.getByRole("button", { name: /copying/i })).toBeDisabled();
  });
});
