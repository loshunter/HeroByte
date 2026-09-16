/**
 * useNpcUpdate: the hook that holds `isUpdating` until the snapshot MATCHES
 * every field it sent — which is the flag NPCEditor's resync guard keys on.
 *
 * It had no test file at all. The sibling hooks did; this one gated the
 * arc's headline fix and could have been rewired to anything.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useNpcUpdate } from "../useNpcUpdate";

const npc = { id: "npc-1", type: "npc" as const, name: "Baker", hp: 6, maxHp: 6 };
const snap = (over: Record<string, unknown> = {}) =>
  ({ characters: [{ ...npc, ...over }] }) as unknown as RoomSnapshot;

/** The full record NPCEditor's commitUpdate sends: every field, every time. */
const full = (over: Record<string, unknown> = {}) => ({
  name: "Baker",
  hp: 6,
  maxHp: 6,
  ...over,
});

describe("useNpcUpdate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a timer from a CONFIRMED update does not kill the one after it", () => {
    // The 5s timeout was armed on every call and never cleared — not even on
    // success. So: update #1 at t=0, confirmed at t=0.2s, its timer still
    // armed. Update #2 at t=3s. At t=5s update #1's timer fires, sees
    // `prev === true` (update #2 in flight), and takes the timeout branch: a
    // false "timed out" banner, targetNpcId nulled so #2 can never confirm,
    // and isUpdating flipped false mid-flight — which re-runs NPCEditor's
    // resync and throws away the optimistic value #2 was protecting.
    const sendMessage = vi.fn();
    let snapshot = snap({ disposition: "hostile" });
    const { result, rerender } = renderHook(() => useNpcUpdate({ snapshot, sendMessage }));

    act(() => result.current.updateNpc("npc-1", full({ disposition: "neutral" })));
    expect(result.current.isUpdating).toBe(true);

    // The server answers #1 at t=0.2s.
    act(() => vi.advanceTimersByTime(200));
    snapshot = snap({ disposition: "neutral" });
    rerender();
    expect(result.current.isUpdating).toBe(false);

    // Update #2 at t=3s: an HP edit, stance carried along by the merge.
    act(() => vi.advanceTimersByTime(2800));
    act(() => result.current.updateNpc("npc-1", full({ hp: 3, disposition: "neutral" })));
    expect(result.current.isUpdating).toBe(true);

    // t=5.1s — where #1's stale timer used to fire.
    act(() => vi.advanceTimersByTime(2100));
    expect(result.current.isUpdating).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.targetNpcId).toBe("npc-1");

    // And #2 can still confirm, because its tracking was not nulled.
    snapshot = snap({ disposition: "neutral", hp: 3 });
    rerender();
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("still reports a timeout when the server never answers", () => {
    // The control: clearing the timer on success must not have made it
    // never fire at all.
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcUpdate({ snapshot: snap(), sendMessage }));

    act(() => result.current.updateNpc("npc-1", full({ hp: 1 })));
    expect(result.current.isUpdating).toBe(true);

    act(() => vi.advanceTimersByTime(4999));
    expect(result.current.isUpdating).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toMatch(/timed out/i);
  });

  it("unmounting mid-flight disarms the timer", () => {
    const sendMessage = vi.fn();
    const { result, unmount } = renderHook(() => useNpcUpdate({ snapshot: snap(), sendMessage }));
    act(() => result.current.updateNpc("npc-1", full({ hp: 1 })));

    unmount();
    // A live timer here would call setState on an unmounted hook.
    expect(vi.getTimerCount()).toBe(0);
  });
});
