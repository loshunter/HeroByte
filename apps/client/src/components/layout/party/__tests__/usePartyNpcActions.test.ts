// The Party's NPC card acts for the DM: an edit sends the NPC's whole record
// (the one-field edit merged over what the snapshot holds), deletion asks the
// DM menu's own question first, and a player's card gets no handler at all.

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { usePartyNpcActions } from "../usePartyNpcActions";

const goblin = {
  id: "npc-1",
  name: "Goblin",
  type: "npc",
  hp: 7,
  maxHp: 9,
  tempHp: 2,
  portrait: "p.png",
  disposition: "neutral",
} as unknown as SnapshotCharacter;
const ranger = { id: "pc-1", name: "Ranger", type: "pc" } as unknown as SnapshotCharacter;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePartyNpcActions", () => {
  it("merges a one-field edit over the NPC's record, keeping its stance", () => {
    const send = vi.fn();
    const { result } = renderHook(() => usePartyNpcActions([goblin], send, true));

    result.current.onNpcUpdate?.("npc-1", { hp: 3 });

    expect(send).toHaveBeenCalledWith({
      t: "update-npc",
      id: "npc-1",
      name: "Goblin",
      hp: 3,
      maxHp: 9,
      tempHp: 2,
      portrait: "p.png",
      tokenImage: undefined,
      initiativeModifier: undefined,
      disposition: "neutral",
    });
  });

  it("a second edit inside one round trip builds on the first, not the old snapshot", () => {
    // Each send is the whole record. Built from the snapshot the first edit
    // was sent from, the second resent the old name and undid the rename.
    const send = vi.fn();
    const { result } = renderHook(() => usePartyNpcActions([goblin], send, true));

    result.current.onNpcUpdate?.("npc-1", { name: "Boss" });
    result.current.onNpcUpdate?.("npc-1", { hp: 3 });

    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Boss", hp: 3 }));
  });

  it("once the snapshot shows the send, edits build on the snapshot again", () => {
    const send = vi.fn();
    let characters = [goblin];
    const { result, rerender } = renderHook(() => usePartyNpcActions(characters, send, true));

    result.current.onNpcUpdate?.("npc-1", { name: "Boss" });
    characters = [{ ...goblin, name: "Boss" } as SnapshotCharacter];
    rerender();
    // A co-DM then changes the temp HP; the next edit must keep it.
    characters = [{ ...goblin, name: "Boss", tempHp: 9 } as SnapshotCharacter];
    rerender();
    result.current.onNpcUpdate?.("npc-1", { hp: 3 });

    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "Boss", tempHp: 9, hp: 3 }),
    );
  });

  it("a send the snapshot never shows stops steering edits after a while", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const { result } = renderHook(() => usePartyNpcActions([goblin], send, true));

    result.current.onNpcUpdate?.("npc-1", { name: "Boss" });
    vi.advanceTimersByTime(5001);
    result.current.onNpcUpdate?.("npc-1", { hp: 3 });

    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Goblin", hp: 3 }));
  });

  it("sends nothing for an id that is not an NPC", () => {
    const send = vi.fn();
    const { result } = renderHook(() => usePartyNpcActions([goblin, ranger], send, true));

    result.current.onNpcUpdate?.("pc-1", { hp: 1 });
    result.current.onNpcPlaceToken?.("pc-1");
    result.current.onNpcDelete?.("pc-1");

    expect(send).not.toHaveBeenCalled();
  });

  it("deletes only after the DM confirms, with the DM menu's question", () => {
    const send = vi.fn();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { result } = renderHook(() => usePartyNpcActions([goblin], send, true));

    result.current.onNpcDelete?.("npc-1");
    expect(send).not.toHaveBeenCalled();
    result.current.onNpcDelete?.("npc-1");

    expect(confirm).toHaveBeenCalledWith(
      'Delete "Goblin"? This also removes its token from the map.',
    );
    expect(send).toHaveBeenCalledExactlyOnceWith({ t: "delete-npc", id: "npc-1" });
  });

  it("gives a player's Party no NPC handler", () => {
    const { result } = renderHook(() => usePartyNpcActions([goblin], vi.fn(), false));

    expect(result.current).toEqual({});
  });
});
