import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Character } from "@shared";
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
});
