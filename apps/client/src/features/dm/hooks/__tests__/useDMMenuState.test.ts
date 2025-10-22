import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Character } from "@shared";
import { useDMMenuState } from "../useDMMenuState";

// ============================================================================
// TESTS FOR useDMMenuState HOOK
// ============================================================================
// Characterization tests for the extracted state management from DMMenu.tsx
// Lines 127-139 in DMMenu.tsx show the state management we extracted

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: `char-${Math.random()}`,
    type: "pc",
    name: "Test Character",
    hp: 10,
    maxHp: 10,
    ...overrides,
  };
}

function createNPC(overrides: Partial<Character> = {}): Character {
  return createCharacter({
    type: "npc",
    name: "Test NPC",
    ...overrides,
  });
}

// ============================================================================
// CHARACTERIZATION TESTS
// ============================================================================

describe("useDMMenuState - Initial State", () => {
  it("initializes with open: false", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.open).toBe(false);
  });

  it("initializes with activeTab: 'map'", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.activeTab).toBe("map");
  });

  it("initializes with sessionName: 'session'", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.sessionName).toBe("session");
  });

  it("initializes with empty npcs array when no characters provided", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.npcs).toEqual([]);
  });

  it("initializes with empty npcs array when only PCs provided", () => {
    const characters = [createCharacter({ type: "pc" }), createCharacter({ type: "pc" })];

    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters }));

    expect(result.current.npcs).toEqual([]);
  });

  it("initializes with npcs array containing only NPCs from characters", () => {
    const npc1 = createNPC({ id: "npc-1", name: "Goblin" });
    const npc2 = createNPC({ id: "npc-2", name: "Orc" });
    const characters = [createCharacter({ type: "pc" }), npc1, npc2];

    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters }));

    expect(result.current.npcs).toEqual([npc1, npc2]);
  });

  it("provides all expected state and setters", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current).toHaveProperty("open");
    expect(result.current).toHaveProperty("setOpen");
    expect(result.current).toHaveProperty("toggleOpen");
    expect(result.current).toHaveProperty("activeTab");
    expect(result.current).toHaveProperty("setActiveTab");
    expect(result.current).toHaveProperty("sessionName");
    expect(result.current).toHaveProperty("setSessionName");
    expect(result.current).toHaveProperty("npcs");
  });
});

describe("useDMMenuState - setOpen", () => {
  it("updates open state to true", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.open).toBe(false);

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);
  });

  it("updates open state to false", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });

    expect(result.current.open).toBe(false);
  });

  it("accepts functional updates", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen((prev) => !prev);
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen((prev) => !prev);
    });

    expect(result.current.open).toBe(false);
  });

  it("maintains callback stability across renders when props are stable", () => {
    const { result, rerender } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    const firstSetOpen = result.current.setOpen;
    rerender();
    const secondSetOpen = result.current.setOpen;

    expect(firstSetOpen).toBe(secondSetOpen);
  });
});

describe("useDMMenuState - toggleOpen", () => {
  it("toggles open from false to true", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.open).toBe(false);

    act(() => {
      result.current.toggleOpen();
    });

    expect(result.current.open).toBe(true);
  });

  it("toggles open from true to false", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.toggleOpen();
    });

    expect(result.current.open).toBe(false);
  });

  it("toggles open multiple times correctly", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.open).toBe(false);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.open).toBe(false);

    act(() => {
      result.current.toggleOpen();
    });
    expect(result.current.open).toBe(true);
  });
});

describe("useDMMenuState - setActiveTab", () => {
  it("updates activeTab to 'npcs'", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.activeTab).toBe("map");

    act(() => {
      result.current.setActiveTab("npcs");
    });

    expect(result.current.activeTab).toBe("npcs");
  });

  it("updates activeTab to 'props'", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setActiveTab("props");
    });

    expect(result.current.activeTab).toBe("props");
  });

  it("updates activeTab to 'session'", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setActiveTab("session");
    });

    expect(result.current.activeTab).toBe("session");
  });

  it("updates activeTab back to 'map'", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setActiveTab("npcs");
    });

    expect(result.current.activeTab).toBe("npcs");

    act(() => {
      result.current.setActiveTab("map");
    });

    expect(result.current.activeTab).toBe("map");
  });

  it("can cycle through all tabs", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    const tabs: Array<"map" | "npcs" | "props" | "session"> = ["map", "npcs", "props", "session"];

    tabs.forEach((tab) => {
      act(() => {
        result.current.setActiveTab(tab);
      });
      expect(result.current.activeTab).toBe(tab);
    });
  });

  it("maintains callback stability across renders when props are stable", () => {
    const { result, rerender } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    const firstSetActiveTab = result.current.setActiveTab;
    rerender();
    const secondSetActiveTab = result.current.setActiveTab;

    expect(firstSetActiveTab).toBe(secondSetActiveTab);
  });
});

describe("useDMMenuState - setSessionName", () => {
  it("updates sessionName to a new value", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    expect(result.current.sessionName).toBe("session");

    act(() => {
      result.current.setSessionName("my-adventure");
    });

    expect(result.current.sessionName).toBe("my-adventure");
  });

  it("updates sessionName multiple times", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setSessionName("adventure-1");
    });
    expect(result.current.sessionName).toBe("adventure-1");

    act(() => {
      result.current.setSessionName("adventure-2");
    });
    expect(result.current.sessionName).toBe("adventure-2");

    act(() => {
      result.current.setSessionName("final-session");
    });
    expect(result.current.sessionName).toBe("final-session");
  });

  it("accepts empty string", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setSessionName("");
    });

    expect(result.current.sessionName).toBe("");
  });

  it("maintains callback stability across renders when props are stable", () => {
    const { result, rerender } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    const firstSetSessionName = result.current.setSessionName;
    rerender();
    const secondSetSessionName = result.current.setSessionName;

    expect(firstSetSessionName).toBe(secondSetSessionName);
  });
});

describe("useDMMenuState - NPC Filtering", () => {
  it("filters out player characters and returns only NPCs", () => {
    const pc1 = createCharacter({ id: "pc-1", type: "pc", name: "Hero" });
    const npc1 = createNPC({ id: "npc-1", name: "Goblin" });
    const pc2 = createCharacter({ id: "pc-2", type: "pc", name: "Wizard" });
    const npc2 = createNPC({ id: "npc-2", name: "Dragon" });

    const { result } = renderHook(() =>
      useDMMenuState({ isDM: true, characters: [pc1, npc1, pc2, npc2] }),
    );

    expect(result.current.npcs).toEqual([npc1, npc2]);
    expect(result.current.npcs).not.toContainEqual(pc1);
    expect(result.current.npcs).not.toContainEqual(pc2);
  });

  it("returns empty array when all characters are PCs", () => {
    const characters = [
      createCharacter({ id: "pc-1", type: "pc" }),
      createCharacter({ id: "pc-2", type: "pc" }),
      createCharacter({ id: "pc-3", type: "pc" }),
    ];

    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters }));

    expect(result.current.npcs).toEqual([]);
  });

  it("returns all characters when all are NPCs", () => {
    const npc1 = createNPC({ id: "npc-1" });
    const npc2 = createNPC({ id: "npc-2" });
    const npc3 = createNPC({ id: "npc-3" });
    const characters = [npc1, npc2, npc3];

    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters }));

    expect(result.current.npcs).toEqual([npc1, npc2, npc3]);
  });

  it("updates npcs when characters array changes", () => {
    const initialCharacters = [createNPC({ id: "npc-1", name: "Goblin" })];

    const { result, rerender } = renderHook(
      ({ characters }: { characters: Character[] }) => useDMMenuState({ isDM: true, characters }),
      { initialProps: { characters: initialCharacters } },
    );

    expect(result.current.npcs).toHaveLength(1);
    expect(result.current.npcs[0]?.name).toBe("Goblin");

    const updatedCharacters = [
      createNPC({ id: "npc-1", name: "Goblin" }),
      createNPC({ id: "npc-2", name: "Orc" }),
    ];

    rerender({ characters: updatedCharacters });

    expect(result.current.npcs).toHaveLength(2);
    expect(result.current.npcs[1]?.name).toBe("Orc");
  });

  it("memoizes npcs array when characters array reference doesn't change", () => {
    const characters = [createNPC({ id: "npc-1" })];

    const { result, rerender } = renderHook(
      ({ chars }: { chars: Character[] }) => useDMMenuState({ isDM: true, characters: chars }),
      { initialProps: { chars: characters } },
    );

    const firstNpcs = result.current.npcs;
    rerender({ chars: characters });
    const secondNpcs = result.current.npcs;

    expect(firstNpcs).toBe(secondNpcs);
  });

  it("creates new npcs array when characters array reference changes even with same content", () => {
    const npc = createNPC({ id: "npc-1", name: "Goblin" });

    const { result, rerender } = renderHook(
      ({ chars }: { chars: Character[] }) => useDMMenuState({ isDM: true, characters: chars }),
      { initialProps: { chars: [npc] } },
    );

    const firstNpcs = result.current.npcs;
    rerender({ chars: [npc] }); // New array reference, same content
    const secondNpcs = result.current.npcs;

    expect(firstNpcs).not.toBe(secondNpcs); // Different array instances
    expect(firstNpcs).toEqual(secondNpcs); // Same content
  });

  it("handles characters with all Character properties", () => {
    const npc = createNPC({
      id: "npc-full",
      name: "Boss Monster",
      portrait: "data:image/png;base64,abc123",
      hp: 50,
      maxHp: 100,
      tokenId: "token-123",
      ownedByPlayerUID: "player-456",
      tokenImage: "https://example.com/token.png",
    });

    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [npc] }));

    expect(result.current.npcs).toHaveLength(1);
    expect(result.current.npcs[0]).toEqual(npc);
  });
});

describe("useDMMenuState - Auto-close Behavior", () => {
  it("closes menu when isDM changes from true to false", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: true } },
    );

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    rerender({ isDM: false });

    expect(result.current.open).toBe(false);
  });

  it("does not close menu when isDM stays true", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: true } },
    );

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    rerender({ isDM: true });

    expect(result.current.open).toBe(true);
  });

  it("does not affect menu state when isDM stays false", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: false } },
    );

    expect(result.current.open).toBe(false);

    rerender({ isDM: false });

    expect(result.current.open).toBe(false);
  });

  it("keeps menu closed when isDM changes from false to true", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: false } },
    );

    expect(result.current.open).toBe(false);

    rerender({ isDM: true });

    expect(result.current.open).toBe(false);
  });

  it("closes menu even if it was just opened when isDM becomes false", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: true } },
    );

    act(() => {
      result.current.setOpen(true);
      rerender({ isDM: false });
    });

    expect(result.current.open).toBe(false);
  });

  it("does not interfere with manual close when isDM is true", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    act(() => {
      result.current.setOpen(false);
    });

    expect(result.current.open).toBe(false);
  });
});

describe("useDMMenuState - State Independence", () => {
  it("changing open does not affect activeTab", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setActiveTab("npcs");
    });

    const tabBefore = result.current.activeTab;

    act(() => {
      result.current.toggleOpen();
    });

    expect(result.current.activeTab).toBe(tabBefore);
    expect(result.current.activeTab).toBe("npcs");
  });

  it("changing activeTab does not affect open", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen(true);
    });

    const openBefore = result.current.open;

    act(() => {
      result.current.setActiveTab("props");
    });

    expect(result.current.open).toBe(openBefore);
    expect(result.current.open).toBe(true);
  });

  it("changing sessionName does not affect other state", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen(true);
      result.current.setActiveTab("session");
    });

    const openBefore = result.current.open;
    const tabBefore = result.current.activeTab;

    act(() => {
      result.current.setSessionName("new-session");
    });

    expect(result.current.open).toBe(openBefore);
    expect(result.current.activeTab).toBe(tabBefore);
    expect(result.current.sessionName).toBe("new-session");
  });

  it("isDM changing does not affect activeTab or sessionName", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: true } },
    );

    act(() => {
      result.current.setActiveTab("npcs");
      result.current.setSessionName("my-session");
    });

    rerender({ isDM: false });

    expect(result.current.activeTab).toBe("npcs");
    expect(result.current.sessionName).toBe("my-session");
  });
});

describe("useDMMenuState - Complex State Transitions", () => {
  it("handles rapid state changes correctly", () => {
    const { result } = renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

    act(() => {
      result.current.setOpen(true);
      result.current.setActiveTab("npcs");
      result.current.setSessionName("test");
      result.current.toggleOpen();
      result.current.setActiveTab("map");
    });

    expect(result.current.open).toBe(false);
    expect(result.current.activeTab).toBe("map");
    expect(result.current.sessionName).toBe("test");
  });

  it("handles multiple isDM transitions correctly", () => {
    const { result, rerender } = renderHook(
      ({ isDM }: { isDM: boolean }) => useDMMenuState({ isDM, characters: [] }),
      { initialProps: { isDM: true } },
    );

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.open).toBe(true);

    rerender({ isDM: false });
    expect(result.current.open).toBe(false);

    rerender({ isDM: true });
    expect(result.current.open).toBe(false); // Stays closed

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.open).toBe(true);

    rerender({ isDM: false });
    expect(result.current.open).toBe(false);
  });

  it("maintains npcs filtering through multiple character updates", () => {
    const pc = createCharacter({ id: "pc-1", type: "pc" });
    const npc1 = createNPC({ id: "npc-1" });

    const { result, rerender } = renderHook(
      ({ chars }: { chars: Character[] }) => useDMMenuState({ isDM: true, characters: chars }),
      { initialProps: { chars: [pc, npc1] } },
    );

    expect(result.current.npcs).toEqual([npc1]);

    const npc2 = createNPC({ id: "npc-2" });
    rerender({ chars: [pc, npc1, npc2] });
    expect(result.current.npcs).toEqual([npc1, npc2]);

    rerender({ chars: [pc, npc2] });
    expect(result.current.npcs).toEqual([npc2]);

    rerender({ chars: [pc] });
    expect(result.current.npcs).toEqual([]);
  });
});
