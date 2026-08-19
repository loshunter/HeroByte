import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Character } from "@herobyte/shared";
import { useBulkInitiativeRoll } from "../useBulkInitiativeRoll";

describe("useBulkInitiativeRoll", () => {
  const onRollAllInitiative = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const many = (n: number): Character[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `npc-${i}`,
      name: `NPC ${i}`,
      type: "npc" as const,
      hp: 10,
      maxHp: 10,
    }));

  it("asks the server once, however many NPCs need a roll", () => {
    // The whole point of the rewrite. This used to send one message per NPC;
    // past 100 in a second the limiter dropped the tail in silence while the
    // toast below still reported the full count.
    const { result } = renderHook(() => useBulkInitiativeRoll(many(200), onRollAllInitiative));

    let count = 0;
    act(() => {
      count = result.current.rollAllInitiative();
    });

    expect(onRollAllInitiative).toHaveBeenCalledTimes(1);
    expect(count).toBe(200);
  });

  it("counts only the NPCs that still lack initiative", () => {
    const npcs: Character[] = [
      { id: "1", name: "NPC1", type: "npc", hp: 10, maxHp: 10, initiativeModifier: 2 },
      { id: "2", name: "NPC2", type: "npc", hp: 10, maxHp: 10, initiative: 15 },
      { id: "3", name: "NPC3", type: "npc", hp: 10, maxHp: 10, initiativeModifier: -1 },
    ];

    const { result } = renderHook(() => useBulkInitiativeRoll(npcs, onRollAllInitiative));

    let count = 0;
    act(() => {
      count = result.current.rollAllInitiative();
    });

    expect(count).toBe(2);
    expect(onRollAllInitiative).toHaveBeenCalledTimes(1);
  });

  it("sends nothing at all when every NPC already has initiative", () => {
    // Not merely "returns 0" — the message must not go out, or the DM's second
    // press would put an empty sweep on the wire and log a no-op server-side.
    const npcs: Character[] = [
      { id: "1", name: "NPC1", type: "npc", hp: 10, maxHp: 10, initiative: 10 },
      { id: "2", name: "NPC2", type: "npc", hp: 10, maxHp: 10, initiative: 15 },
    ];

    const { result } = renderHook(() => useBulkInitiativeRoll(npcs, onRollAllInitiative));

    let count = 0;
    act(() => {
      count = result.current.rollAllInitiative();
    });

    expect(count).toBe(0);
    expect(onRollAllInitiative).not.toHaveBeenCalled();
  });

  it("sends nothing for an empty roster", () => {
    const { result } = renderHook(() => useBulkInitiativeRoll([], onRollAllInitiative));

    let count = 0;
    act(() => {
      count = result.current.rollAllInitiative();
    });

    expect(count).toBe(0);
    expect(onRollAllInitiative).not.toHaveBeenCalled();
  });

  it("computes no initiative value itself — the server owns every number", () => {
    // The callback takes no arguments by design. If a roll or a modifier ever
    // reappears on this path it is a client-invented number again, which is
    // the defect the whole slice exists to remove.
    const spy = vi.spyOn(Math, "random");
    const { result } = renderHook(() => useBulkInitiativeRoll(many(3), onRollAllInitiative));

    act(() => {
      result.current.rollAllInitiative();
    });

    expect(spy).not.toHaveBeenCalled();
    expect(onRollAllInitiative).toHaveBeenCalledWith();
    spy.mockRestore();
  });
});
