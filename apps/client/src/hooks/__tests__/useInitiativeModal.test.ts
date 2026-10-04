// ============================================================================
// INITIATIVE MODAL HOOK - TESTS
// ============================================================================
// Test-driven development for initiative modal state management

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInitiativeModal } from "../useInitiativeModal";
import type { Character } from "@herobyte/shared";

describe("useInitiativeModal", () => {
  const createMockCharacter = (id: string, initiative?: number): Character => ({
    id,
    type: "pc",
    name: `Character ${id}`,
    hp: 100,
    maxHp: 100,
    ownedByPlayerUID: "player-1",
    initiative,
    initiativeModifier: 0,
  });

  const characters = ["char-1", "char-2"].map((id) => createMockCharacter(id));

  describe("initial state", () => {
    it("should start with null (no modal open)", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));

      expect(result.current.character).toBeNull();
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("openModal", () => {
    it("should open modal with the specified character", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));
      const character = characters[0];

      act(() => {
        result.current.openModal(character);
      });

      expect(result.current.character).toEqual(character);
      expect(result.current.isOpen).toBe(true);
    });

    it("should replace previously open character", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));
      const [char1, char2] = characters;

      act(() => {
        result.current.openModal(char1);
      });

      expect(result.current.character?.id).toBe("char-1");

      act(() => {
        result.current.openModal(char2);
      });

      expect(result.current.character?.id).toBe("char-2");
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe("closeModal", () => {
    it("should close the modal and clear character", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));
      const character = characters[0];

      act(() => {
        result.current.openModal(character);
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.character).toBeNull();
      expect(result.current.isOpen).toBe(false);
    });

    it("should be idempotent (safe to call multiple times)", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));

      act(() => {
        result.current.closeModal();
        result.current.closeModal();
      });

      expect(result.current.character).toBeNull();
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("isOpen computed property", () => {
    it("should be true when character is set", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));
      const character = characters[0];

      act(() => {
        result.current.openModal(character);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it("should be false when character is null", () => {
      const { result } = renderHook(() => useInitiativeModal(characters, true));

      expect(result.current.isOpen).toBe(false);

      const character = characters[0];
      act(() => {
        result.current.openModal(character);
      });

      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("the live record", () => {
    it("follows the character's current record, and closes for good when it is gone", () => {
      const { result, rerender } = renderHook(({ list }) => useInitiativeModal(list, true), {
        initialProps: { list: characters },
      });
      act(() => {
        result.current.openModal(characters[0]);
      });

      const renamed = { ...characters[0], name: "Renamed" };
      rerender({ list: [renamed, characters[1]] });
      expect(result.current.character).toBe(renamed);

      rerender({ list: [characters[1]] });
      expect(result.current.isOpen).toBe(false);

      rerender({ list: characters });
      expect(result.current.isOpen).toBe(false);
    });
  });
});
