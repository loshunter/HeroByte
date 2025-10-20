/**
 * Characterization tests for useVoiceChatManager hook.
 *
 * These tests capture the CURRENT BEHAVIOR of voice chat management
 * extracted from App.tsx (lines 14, 29, 137, 262-274).
 *
 * Source: apps/client/src/ui/App.tsx (lines 137 + 262-274)
 * Target: apps/client/src/hooks/useVoiceChatManager.ts
 *
 * DO NOT modify tests to match new behavior. If behavior changes,
 * these tests should fail to indicate a regression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot, ClientMessage, Player } from "@shared";
import { useVoiceChatManager } from "../useVoiceChatManager";

// Mock dependencies
const mockSendMessage = vi.fn();
const mockRegisterRtcHandler = vi.fn();

// Mock the underlying hooks
vi.mock("../useMicrophone", () => ({
  useMicrophone: vi.fn(({ sendMessage }) => ({
    micEnabled: false,
    micLevel: 0,
    micStream: null,
    toggleMic: vi.fn(async () => {
      // Mock toggle behavior
      sendMessage({ t: "mic-level", level: 0 });
    }),
  })),
}));

vi.mock("../../ui/useVoiceChat", () => ({
  useVoiceChat: vi.fn(() => ({
    connectedPeers: [],
  })),
}));

import { useMicrophone } from "../useMicrophone";
import { useVoiceChat } from "../../ui/useVoiceChat";

describe("useVoiceChatManager - Characterization Tests", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    mockRegisterRtcHandler.mockClear();
    vi.clearAllMocks();
  });

  describe("Hook Integration", () => {
    it("should call useMicrophone with sendMessage", () => {
      const mockSnapshot: RoomSnapshot | null = null;

      renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(useMicrophone).toHaveBeenCalledWith({
        sendMessage: mockSendMessage,
      });
    });

    it("should compute otherPlayerUIDs from snapshot", () => {
      const mockSnapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: [
          { uid: "player-1", name: "Player 1", hp: 100, maxHp: 100 } as Player,
          { uid: "player-2", name: "Player 2", hp: 100, maxHp: 100 } as Player,
          { uid: "player-3", name: "Player 3", hp: 100, maxHp: 100 } as Player,
        ],
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(useVoiceChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherPlayerUIDs: ["player-2", "player-3"],
        }),
      );
    });

    it("should exclude current player from otherPlayerUIDs", () => {
      const mockSnapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: [
          { uid: "player-1", name: "Player 1", hp: 100, maxHp: 100 } as Player,
          { uid: "player-2", name: "Player 2", hp: 100, maxHp: 100 } as Player,
        ],
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(useVoiceChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherPlayerUIDs: ["player-2"],
        }),
      );
    });

    it("should handle empty snapshot", () => {
      const mockSnapshot: RoomSnapshot | null = null;

      renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(useVoiceChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherPlayerUIDs: [],
        }),
      );
    });

    it("should pass correct params to useVoiceChat", () => {
      const mockSnapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: [
          { uid: "player-1", name: "Player 1", hp: 100, maxHp: 100 } as Player,
          { uid: "player-2", name: "Player 2", hp: 100, maxHp: 100 } as Player,
        ],
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(useVoiceChat).toHaveBeenCalledWith({
        sendMessage: mockSendMessage,
        onRtcSignal: mockRegisterRtcHandler,
        uid: "player-1",
        otherPlayerUIDs: ["player-2"],
        enabled: false, // micEnabled from mock
        stream: null, // micStream from mock
      });
    });
  });

  describe("Return Values", () => {
    it("should return micEnabled from useMicrophone", () => {
      const mockSnapshot: RoomSnapshot | null = null;

      const { result } = renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(result.current).toHaveProperty("micEnabled");
      expect(typeof result.current.micEnabled).toBe("boolean");
    });

    it("should return toggleMic function from useMicrophone", () => {
      const mockSnapshot: RoomSnapshot | null = null;

      const { result } = renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(result.current).toHaveProperty("toggleMic");
      expect(typeof result.current.toggleMic).toBe("function");
    });

    it("should allow calling toggleMic", async () => {
      const mockSnapshot: RoomSnapshot | null = null;
      const mockToggleMic = vi.fn();

      vi.mocked(useMicrophone).mockReturnValueOnce({
        micEnabled: false,
        micLevel: 0,
        micStream: null,
        toggleMic: mockToggleMic,
      });

      const { result } = renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      await act(async () => {
        await result.current.toggleMic();
      });

      expect(mockToggleMic).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle snapshot with no players array", () => {
      const mockSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: undefined,
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      } as unknown as RoomSnapshot;

      renderHook(() =>
        useVoiceChatManager({
          uid: "player-1",
          snapshot: mockSnapshot,
          sendMessage: mockSendMessage,
          registerRtcHandler: mockRegisterRtcHandler,
        }),
      );

      expect(useVoiceChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherPlayerUIDs: [],
        }),
      );
    });

    it("should update otherPlayerUIDs when snapshot changes", () => {
      const initialSnapshot: RoomSnapshot = {
        gridSize: 50,
        gridSquareSize: 5,
        mapBackground: "",
        players: [
          { uid: "player-1", name: "Player 1", hp: 100, maxHp: 100 } as Player,
          { uid: "player-2", name: "Player 2", hp: 100, maxHp: 100 } as Player,
        ],
        characters: [],
        tokens: [],
        drawings: [],
        diceRolls: [],
        pointers: [],
        sceneObjects: [],
        props: [],
      };

      const { rerender } = renderHook(
        ({ snapshot }) =>
          useVoiceChatManager({
            uid: "player-1",
            snapshot,
            sendMessage: mockSendMessage,
            registerRtcHandler: mockRegisterRtcHandler,
          }),
        { initialProps: { snapshot: initialSnapshot } },
      );

      // Clear previous calls
      vi.clearAllMocks();

      // Update snapshot with new player
      const updatedSnapshot: RoomSnapshot = {
        ...initialSnapshot,
        players: [
          { uid: "player-1", name: "Player 1", hp: 100, maxHp: 100 } as Player,
          { uid: "player-2", name: "Player 2", hp: 100, maxHp: 100 } as Player,
          { uid: "player-3", name: "Player 3", hp: 100, maxHp: 100 } as Player,
        ],
      };

      rerender({ snapshot: updatedSnapshot });

      // Should be called with updated player list
      expect(useVoiceChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherPlayerUIDs: ["player-2", "player-3"],
        }),
      );
    });
  });
});
