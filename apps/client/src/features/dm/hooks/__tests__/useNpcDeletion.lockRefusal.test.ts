// Deleting an NPC waits for the snapshot and times out after 5 s. When the lock
// refused it (the toast already said why), it stops waiting: a refusal followed by
// "NPC deletion timed out. Please try again." told the DM to retry what cannot work.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { useNpcDeletion } from "../useNpcDeletion";
import { useNpcTokenPlacement } from "../useNpcTokenPlacement";
import { deliverLockRefusal } from "../../../locking/lockRefusalBridge";

const snapshot = {
  characters: [{ id: "npc-1", name: "Goblin", type: "npc", tokenId: "t-1" }],
  tokens: [],
} as unknown as RoomSnapshot;

describe("NPC actions stop waiting when the lock refuses them", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("delete: a refusal ends the wait with no timed-out error", () => {
    const { result } = renderHook(() => useNpcDeletion({ snapshot, sendMessage: vi.fn() }));
    act(() => result.current.deleteNpc("npc-1"));
    expect(result.current.isDeleting).toBe(true);
    act(() => deliverLockRefusal({ t: "locked-refused", ids: ["token:t-1"], elsewhere: true }));
    expect(result.current.isDeleting).toBe(false);
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.error).toBeNull();
  });

  it("control: with no refusal the wait still times out", () => {
    const { result } = renderHook(() => useNpcDeletion({ snapshot, sendMessage: vi.fn() }));
    act(() => result.current.deleteNpc("npc-1"));
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.error).toBe("NPC deletion timed out. Please try again.");
  });

  it("place token: a refusal ends the wait with no timed-out error", () => {
    const { result } = renderHook(() => useNpcTokenPlacement({ snapshot, sendMessage: vi.fn() }));
    act(() => result.current.placeToken("npc-1"));
    expect(result.current.isPlacing).toBe(true);
    act(() => deliverLockRefusal({ t: "locked-refused", ids: ["token:t-1"] }));
    expect(result.current.isPlacing).toBe(false);
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.error).toBeNull();
  });

  it("a refusal of some other piece does not end the wait", () => {
    const { result } = renderHook(() => useNpcDeletion({ snapshot, sendMessage: vi.fn() }));
    act(() => result.current.deleteNpc("npc-1"));
    act(() => deliverLockRefusal({ t: "locked-refused", ids: ["token:someone-else"] }));
    expect(result.current.isDeleting).toBe(true);
  });

  it("a refused attempt's timer does not time out the retry", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcTokenPlacement({ snapshot, sendMessage }));
    act(() => result.current.placeToken("npc-1"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => deliverLockRefusal({ t: "locked-refused", ids: ["token:t-1"] }));
    act(() => result.current.placeToken("npc-1"));
    act(() => vi.advanceTimersByTime(3000)); // 6 s after the first attempt, 3 s into the retry
    expect(result.current.isPlacing).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
