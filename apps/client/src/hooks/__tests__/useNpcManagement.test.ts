/**
 * Characterization tests for useNpcManagement hook
 *
 * These tests capture the behavior of the original NPC management code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 401-451)
 * Target: apps/client/src/hooks/useNpcManagement.ts
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNpcManagement } from "../useNpcManagement.js";
import type { RoomSnapshot, Character, ClientMessage } from "@shared";

describe("useNpcManagement - Characterization", () => {
  const mockSendMessage = vi.fn();

  const createMockSnapshot = (characters: Character[] = []): RoomSnapshot => ({
    players: [],
    characters,
    tokens: [],
    sceneObjects: [],
    drawings: [],
    mapBackground: undefined,
    playerStagingZone: undefined,
    gridSize: 50,
    gridSquareSize: 5,
    diceRolls: [],
    props: [],
    dmPassword: undefined,
    dmPasswordUpdatedAt: undefined,
    roomSecret: "test-secret",
    roomSecretUpdatedAt: Date.now(),
    roomSecretSource: "env",
  });

  const createMockNPC = (
    id: string,
    name: string,
    hp: number,
    maxHp: number,
    portrait?: string,
    tokenImage?: string | null,
  ): Character => ({
    id,
    type: "npc",
    name,
    hp,
    maxHp,
    portrait,
    tokenImage,
    tokenId: null,
    ownedByPlayerUID: null,
  });

  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  describe("handleCreateNPC", () => {
    it("should send create-npc message with default values", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handleCreateNPC();
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "create-npc",
        name: "New NPC",
        hp: 10,
        maxHp: 10,
      });
    });

    it("should send create-npc message each time it's called", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handleCreateNPC();
        result.current.handleCreateNPC();
        result.current.handleCreateNPC();
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
        t: "create-npc",
        name: "New NPC",
        hp: 10,
        maxHp: 10,
      });
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
        t: "create-npc",
        name: "New NPC",
        hp: 10,
        maxHp: 10,
      });
      expect(mockSendMessage).toHaveBeenNthCalledWith(3, {
        t: "create-npc",
        name: "New NPC",
        hp: 10,
        maxHp: 10,
      });
    });
  });

  describe("handleUpdateNPC", () => {
    it("should send update-npc message with merged updates and existing values", () => {
      const existingNPC = createMockNPC(
        "npc-1",
        "Goblin",
        20,
        30,
        "portrait-url",
        "token-url",
      );
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-1", { name: "Goblin Leader" });
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-1",
        name: "Goblin Leader",
        hp: 20,
        maxHp: 30,
        portrait: "portrait-url",
        tokenImage: "token-url",
      });
    });

    it("should send update-npc message with partial updates (hp only)", () => {
      const existingNPC = createMockNPC("npc-2", "Orc", 50, 50);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-2", { hp: 25 });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-2",
        name: "Orc",
        hp: 25,
        maxHp: 50,
        portrait: undefined,
        tokenImage: undefined,
      });
    });

    it("should send update-npc message with partial updates (maxHp only)", () => {
      const existingNPC = createMockNPC("npc-3", "Dragon", 100, 100);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-3", { maxHp: 150 });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-3",
        name: "Dragon",
        hp: 100,
        maxHp: 150,
        portrait: undefined,
        tokenImage: undefined,
      });
    });

    it("should send update-npc message with portrait update", () => {
      const existingNPC = createMockNPC("npc-4", "Wizard", 30, 30);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-4", {
          portrait: "new-portrait-url",
        });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-4",
        name: "Wizard",
        hp: 30,
        maxHp: 30,
        portrait: "new-portrait-url",
        tokenImage: undefined,
      });
    });

    it("should send update-npc message with tokenImage update", () => {
      const existingNPC = createMockNPC("npc-5", "Knight", 40, 40);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-5", {
          tokenImage: "new-token-url",
        });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-5",
        name: "Knight",
        hp: 40,
        maxHp: 40,
        portrait: undefined,
        tokenImage: "new-token-url",
      });
    });

    it("should send update-npc message with multiple field updates", () => {
      const existingNPC = createMockNPC("npc-6", "Troll", 60, 60);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-6", {
          name: "Cave Troll",
          hp: 45,
          maxHp: 70,
          portrait: "troll-portrait",
          tokenImage: "troll-token",
        });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-6",
        name: "Cave Troll",
        hp: 45,
        maxHp: 70,
        portrait: "troll-portrait",
        tokenImage: "troll-token",
      });
    });

    it("should NOT send message if NPC does not exist in snapshot", () => {
      const snapshot = createMockSnapshot([]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("non-existent-npc", {
          name: "Ghost NPC",
        });
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should NOT send message if snapshot is null", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: null,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-1", { name: "Test" });
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should NOT send message if snapshot.characters is undefined", () => {
      const snapshot = createMockSnapshot([]);
      delete (snapshot as any).characters;

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-1", { name: "Test" });
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should handle null tokenImage by converting to undefined in message", () => {
      const existingNPC = createMockNPC("npc-7", "Bandit", 15, 15, undefined, null);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-7", { name: "Bandit Leader" });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-7",
        name: "Bandit Leader",
        hp: 15,
        maxHp: 15,
        portrait: undefined,
        tokenImage: undefined, // null converted to undefined
      });
    });

    it("should preserve existing null portrait when not updated", () => {
      const existingNPC = createMockNPC("npc-8", "Skeleton", 10, 10);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-8", { hp: 5 });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-8",
        name: "Skeleton",
        hp: 5,
        maxHp: 10,
        portrait: undefined,
        tokenImage: undefined,
      });
    });

    it("should update NPC found among PC characters array", () => {
      const pc = createMockNPC("pc-1", "Hero", 50, 50);
      pc.type = "pc";
      const npc = createMockNPC("npc-9", "Villain", 80, 80);
      const snapshot = createMockSnapshot([pc, npc]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-9", { hp: 60 });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-9",
        name: "Villain",
        hp: 60,
        maxHp: 80,
        portrait: undefined,
        tokenImage: undefined,
      });
    });
  });

  describe("handleDeleteNPC", () => {
    it("should send delete-npc message with id", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handleDeleteNPC("npc-to-delete");
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "delete-npc",
        id: "npc-to-delete",
      });
    });

    it("should send delete-npc message multiple times for different NPCs", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handleDeleteNPC("npc-1");
        result.current.handleDeleteNPC("npc-2");
        result.current.handleDeleteNPC("npc-3");
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
        t: "delete-npc",
        id: "npc-1",
      });
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
        t: "delete-npc",
        id: "npc-2",
      });
      expect(mockSendMessage).toHaveBeenNthCalledWith(3, {
        t: "delete-npc",
        id: "npc-3",
      });
    });
  });

  describe("handlePlaceNPCToken", () => {
    it("should send place-npc-token message with id", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handlePlaceNPCToken("npc-token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "place-npc-token",
        id: "npc-token-1",
      });
    });

    it("should send place-npc-token message multiple times for different NPCs", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handlePlaceNPCToken("npc-1");
        result.current.handlePlaceNPCToken("npc-2");
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenNthCalledWith(1, {
        t: "place-npc-token",
        id: "npc-1",
      });
      expect(mockSendMessage).toHaveBeenNthCalledWith(2, {
        t: "place-npc-token",
        id: "npc-2",
      });
    });
  });

  describe("Callback Stability", () => {
    it("should maintain callback stability when snapshot doesn't change", () => {
      const snapshot = createMockSnapshot();
      const { result, rerender } = renderHook(
        ({ snapshot, sendMessage }) =>
          useNpcManagement({
            sendMessage,
            snapshot,
          }),
        {
          initialProps: {
            snapshot,
            sendMessage: mockSendMessage,
          },
        },
      );

      const initialCreateNPC = result.current.handleCreateNPC;
      const initialUpdateNPC = result.current.handleUpdateNPC;
      const initialDeleteNPC = result.current.handleDeleteNPC;
      const initialPlaceNPCToken = result.current.handlePlaceNPCToken;

      // Rerender with same props (same snapshot object)
      rerender({ snapshot, sendMessage: mockSendMessage });

      expect(result.current.handleCreateNPC).toBe(initialCreateNPC);
      expect(result.current.handleUpdateNPC).toBe(initialUpdateNPC);
      expect(result.current.handleDeleteNPC).toBe(initialDeleteNPC);
      expect(result.current.handlePlaceNPCToken).toBe(initialPlaceNPCToken);
    });

    it("should update handleUpdateNPC when snapshot changes", () => {
      const snapshot1 = createMockSnapshot([
        createMockNPC("npc-1", "Goblin", 20, 20),
      ]);

      const { result, rerender } = renderHook(
        ({ snapshot }) =>
          useNpcManagement({
            sendMessage: mockSendMessage,
            snapshot,
          }),
        {
          initialProps: { snapshot: snapshot1 },
        },
      );

      const initialUpdateNPC = result.current.handleUpdateNPC;

      const snapshot2 = createMockSnapshot([
        createMockNPC("npc-1", "Goblin", 20, 20),
        createMockNPC("npc-2", "Orc", 30, 30),
      ]);

      rerender({ snapshot: snapshot2 });

      // Callback should change because snapshot.characters dependency changed
      expect(result.current.handleUpdateNPC).not.toBe(initialUpdateNPC);
    });

    it("should update handleUpdateNPC when sendMessage changes", () => {
      const mockSendMessage1 = vi.fn();
      const mockSendMessage2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ sendMessage }) =>
          useNpcManagement({
            sendMessage,
            snapshot: createMockSnapshot(),
          }),
        {
          initialProps: { sendMessage: mockSendMessage1 },
        },
      );

      const initialUpdateNPC = result.current.handleUpdateNPC;

      rerender({ sendMessage: mockSendMessage2 });

      // Callback should change because sendMessage dependency changed
      expect(result.current.handleUpdateNPC).not.toBe(initialUpdateNPC);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty characters array", () => {
      const snapshot = createMockSnapshot([]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-1", { name: "Test" });
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should handle updating NPC with empty updates object", () => {
      const existingNPC = createMockNPC("npc-1", "Goblin", 20, 20);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-1", {});
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-1",
        name: "Goblin",
        hp: 20,
        maxHp: 20,
        portrait: undefined,
        tokenImage: undefined,
      });
    });

    it("should handle special characters in NPC IDs", () => {
      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot: createMockSnapshot(),
        }),
      );

      act(() => {
        result.current.handleDeleteNPC("npc-!@#$%^&*()");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "delete-npc",
        id: "npc-!@#$%^&*()",
      });
    });

    it("should handle NPC with zero hp and maxHp", () => {
      const existingNPC = createMockNPC("npc-dead", "Dead Goblin", 0, 0);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-dead", { name: "Resurrected Goblin" });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-dead",
        name: "Resurrected Goblin",
        hp: 0,
        maxHp: 0,
        portrait: undefined,
        tokenImage: undefined,
      });
    });

    it("should handle NPC with negative hp", () => {
      const existingNPC = createMockNPC("npc-overkill", "Obliterated Goblin", -10, 20);
      const snapshot = createMockSnapshot([existingNPC]);

      const { result } = renderHook(() =>
        useNpcManagement({
          sendMessage: mockSendMessage,
          snapshot,
        }),
      );

      act(() => {
        result.current.handleUpdateNPC("npc-overkill", { hp: 5 });
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-npc",
        id: "npc-overkill",
        name: "Obliterated Goblin",
        hp: 5,
        maxHp: 20,
        portrait: undefined,
        tokenImage: undefined,
      });
    });
  });
});
