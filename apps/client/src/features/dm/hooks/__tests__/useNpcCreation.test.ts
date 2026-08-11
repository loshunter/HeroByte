/**
 * Tests for useNpcCreation (S8 widened it with a count).
 *
 * The single-flight guard is why `count` rides on ONE message instead of the
 * client sending N. This hook refuses to start a second create while one is in
 * flight and only console.warns about it — so a naive `for (…) createNpc()`
 * would fire once and silently drop the rest. These tests pin that.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useNpcCreation } from "../useNpcCreation";

function snapshotWithNpcs(count: number): RoomSnapshot {
  return {
    characters: Array.from({ length: count }, (_, i) => ({
      id: `npc-${i}`,
      type: "npc" as const,
      name: `Goblin ${i + 1}`,
      hp: 10,
      maxHp: 10,
    })),
  } as unknown as RoomSnapshot;
}

describe("useNpcCreation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends the historic default when called with nothing", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcCreation({ snapshot: null, sendMessage }));

    act(() => result.current.createNpc());

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      t: "create-npc",
      name: "New NPC",
      hp: 10,
      maxHp: 10,
    });
  });

  it("omits count entirely when none is asked for", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcCreation({ snapshot: null, sendMessage }));

    act(() => result.current.createNpc());

    // An explicit `count: undefined` would still be a key on the wire; the
    // server's optional-field validation is happier without it.
    expect(Object.keys(sendMessage.mock.calls[0][0])).not.toContain("count");
  });

  it("carries a count on a single message rather than sending N", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcCreation({ snapshot: null, sendMessage }));

    act(() => result.current.createNpc({ name: "Goblin", count: 5 }));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "create-npc", name: "Goblin", count: 5 }),
    );
  });

  it("forwards portrait and token art for a duplicate", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcCreation({ snapshot: null, sendMessage }));

    act(() =>
      result.current.createNpc({
        name: "Goblin 3",
        hp: 4,
        maxHp: 7,
        portrait: "p.png",
        tokenImage: "t.png",
      }),
    );

    expect(sendMessage).toHaveBeenCalledWith({
      t: "create-npc",
      name: "Goblin 3",
      hp: 4,
      maxHp: 7,
      portrait: "p.png",
      tokenImage: "t.png",
    });
  });

  it("drops a second create while one is in flight — the reason count exists", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useNpcCreation({ snapshot: null, sendMessage }));

    act(() => {
      result.current.createNpc({ name: "Goblin" });
    });
    act(() => {
      result.current.createNpc({ name: "Goblin" });
      result.current.createNpc({ name: "Goblin" });
    });

    // Five separate calls would have produced ONE goblin. This is why the
    // count travels on the message and the server loops.
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("clears its loading state when the batch lands as one count jump", () => {
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(
      ({ snapshot }) => useNpcCreation({ snapshot, sendMessage }),
      { initialProps: { snapshot: snapshotWithNpcs(0) } },
    );

    act(() => result.current.createNpc({ name: "Goblin", count: 5 }));
    expect(result.current.isCreating).toBe(true);

    // The server adds all five at once, so the count moves 0 -> 5 in a single
    // snapshot. Success detection must not expect +1.
    rerender({ snapshot: snapshotWithNpcs(5) });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports a timeout when nothing comes back", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useNpcCreation({ snapshot: snapshotWithNpcs(0), sendMessage }),
    );

    act(() => result.current.createNpc({ count: 3 }));
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.isCreating).toBe(false);
    expect(result.current.error).toBe("NPC creation timed out. Please try again.");
  });

  it("allows another create once the batch has landed", () => {
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(
      ({ snapshot }) => useNpcCreation({ snapshot, sendMessage }),
      { initialProps: { snapshot: snapshotWithNpcs(0) } },
    );

    act(() => result.current.createNpc({ name: "Goblin", count: 2 }));
    rerender({ snapshot: snapshotWithNpcs(2) });
    act(() => result.current.createNpc({ name: "Goblin", count: 3 }));

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1][0]).toMatchObject({ count: 3 });
  });
});
