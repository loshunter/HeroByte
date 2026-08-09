import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Character } from "@herobyte/shared";
import { useBulkInitiativeRoll } from "../useBulkInitiativeRoll";

describe("useBulkInitiativeRoll", () => {
  const mockSetInitiative = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters and rolls for NPCs without initiative", async () => {
    const npcs: Character[] = [
      { id: "1", name: "NPC1", type: "npc", hp: 10, maxHp: 10, initiativeModifier: 2 },
      { id: "2", name: "NPC2", type: "npc", hp: 10, maxHp: 10, initiative: 15 },
      { id: "3", name: "NPC3", type: "npc", hp: 10, maxHp: 10, initiativeModifier: -1 },
    ];

    const { result } = renderHook(() => useBulkInitiativeRoll(npcs, mockSetInitiative));

    const count = await act(async () => result.current.rollAllInitiative());

    expect(count).toBe(2);
    expect(mockSetInitiative).toHaveBeenCalledTimes(2);
  });

  it("returns zero for empty array", async () => {
    const { result } = renderHook(() => useBulkInitiativeRoll([], mockSetInitiative));

    const count = await act(async () => result.current.rollAllInitiative());

    expect(count).toBe(0);
    expect(mockSetInitiative).not.toHaveBeenCalled();
  });

  it("returns zero when all NPCs have initiative", async () => {
    const npcs: Character[] = [
      { id: "1", name: "NPC1", type: "npc", hp: 10, maxHp: 10, initiative: 10 },
      { id: "2", name: "NPC2", type: "npc", hp: 10, maxHp: 10, initiative: 15 },
    ];

    const { result } = renderHook(() => useBulkInitiativeRoll(npcs, mockSetInitiative));

    const count = await act(async () => result.current.rollAllInitiative());

    expect(count).toBe(0);
    expect(mockSetInitiative).not.toHaveBeenCalled();
  });

  it("uses modifier of 0 when not set", async () => {
    const npcs: Character[] = [
      { id: "1", name: "NPC1", type: "npc", hp: 10, maxHp: 10 }, // No modifier
    ];

    const { result } = renderHook(() => useBulkInitiativeRoll(npcs, mockSetInitiative));

    await act(async () => result.current.rollAllInitiative());

    expect(mockSetInitiative).toHaveBeenCalledWith("1", expect.any(Number), 0);
  });

  describe("against the server's rate limiter", () => {
    const many = (n: number): Character[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `npc-${i}`,
        name: `NPC ${i}`,
        type: "npc" as const,
        hp: 10,
        maxHp: 10,
      }));

    it("sends an ordinary encounter in one go, with no delay", async () => {
      // 20 is a full ×N batch — the common case must not have become slower.
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useBulkInitiativeRoll(many(20), mockSetInitiative));

        let done = false;
        await act(async () => {
          void result.current.rollAllInitiative().then(() => {
            done = true;
          });
          await Promise.resolve();
        });

        expect(mockSetInitiative).toHaveBeenCalledTimes(20);
        expect(done).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not fire more than the limiter's budget in one tick", async () => {
      // The server allows 100 messages per second per client and drops the
      // rest with no reply, so a 200-NPC room used to lose the tail silently
      // while the toast reported the full count. The loop is bounded by NPCs
      // lacking initiative — up to the 500-character room ceiling — NOT by the
      // ×N ceiling of 20.
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useBulkInitiativeRoll(many(200), mockSetInitiative));

        const pending = result.current.rollAllInitiative();
        await act(async () => {
          await Promise.resolve();
        });

        // First batch only — the rest are waiting on a timer.
        expect(mockSetInitiative.mock.calls.length).toBeLessThanOrEqual(100);
        const afterFirstBatch = mockSetInitiative.mock.calls.length;

        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });
        await act(async () => {
          await expect(pending).resolves.toBe(200);
        });

        expect(mockSetInitiative).toHaveBeenCalledTimes(200);
        expect(afterFirstBatch).toBeLessThan(200);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
