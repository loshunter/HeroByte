/**
 * Characterization tests for usePlayerActions hook.
 *
 * These tests capture the CURRENT BEHAVIOR of player action creators
 * extracted from App.tsx (lines 400-664).
 *
 * DO NOT modify tests to match new behavior. If behavior changes,
 * these tests should fail to indicate a regression.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PlayerState, PlayerStagingZone, Snapshot, Character } from "@shared";
import { usePlayerActions } from "../../usePlayerActions";

// Mock dependencies
const mockSendMessage = vi.fn();
const mockSnapshot: Snapshot = {
  gridSize: 50,
  gridSquareSize: 5,
  mapBackgroundURL: "",
  players: [],
  characters: [
    {
      id: "char-1",
      name: "Test Character",
      ownedByPlayerUID: "player-1",
      type: "player-character",
      hp: 100,
      maxHp: 100,
    },
  ] as Character[],
  tokens: [],
  drawings: [],
  diceRolls: [],
  pointers: [],
};

describe("usePlayerActions - Characterization Tests", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    vi.clearAllMocks();
  });

  describe("Simple Player Actions", () => {
    it("should rename player with correct message", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.renamePlayer("New Name");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "rename",
        name: "New Name",
      });
    });

    it("should set portrait URL with logging", () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.setPortrait("https://example.com/portrait.png");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[App] Setting portrait URL:"),
      );
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "portrait",
        data: "https://example.com/portrait.png",
      });

      consoleLogSpy.mockRestore();
    });

    it("should set player HP with correct values", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.setHP(75, 100);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-hp",
        hp: 75,
        maxHp: 100,
      });
    });

    it("should set status effects", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.setStatusEffects(["Poisoned", "Stunned"]);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-status-effects",
        effects: ["Poisoned", "Stunned"],
      });
    });
  });

  describe("Character Management", () => {
    it("should add character with default maxHp", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.addCharacter("Aragorn");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "add-player-character",
        name: "Aragorn",
        maxHp: 100,
      });
    });

    it("should update character name", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.updateCharacterName("char-1", "Legolas");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-character-name",
        characterId: "char-1",
        name: "Legolas",
      });
    });

    it("should not delete character if not found in snapshot", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.deleteCharacter("nonexistent-char");
      });

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(confirmSpy).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it("should delete character after confirmation", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      const snapshot = {
        ...mockSnapshot,
        characters: [
          {
            id: "char-1",
            name: "Test Character",
            ownedByPlayerUID: "player-1",
            type: "player-character",
            hp: 100,
            maxHp: 100,
          },
          {
            id: "char-2",
            name: "Another Character",
            ownedByPlayerUID: "player-1",
            type: "player-character",
            hp: 100,
            maxHp: 100,
          },
        ] as Character[],
      };

      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.deleteCharacter("char-1");
      });

      expect(confirmSpy).toHaveBeenCalledWith(
        "Delete this character? This will remove the character and their token.",
      );
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "delete-player-character",
        characterId: "char-1",
      });

      confirmSpy.mockRestore();
    });

    it("should not delete character if confirmation is cancelled", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      const snapshot = {
        ...mockSnapshot,
        characters: [
          {
            id: "char-1",
            name: "Test Character",
            ownedByPlayerUID: "player-1",
            type: "player-character",
            hp: 100,
            maxHp: 100,
          },
        ] as Character[],
      };

      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.deleteCharacter("char-1");
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it("should prompt for new character after deleting last character", () => {
      vi.useFakeTimers();
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("New Hero");

      const snapshot = {
        ...mockSnapshot,
        characters: [
          {
            id: "char-1",
            name: "Last Character",
            ownedByPlayerUID: "player-1",
            type: "player-character",
            hp: 100,
            maxHp: 100,
          },
        ] as Character[],
      };

      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.deleteCharacter("char-1");
      });

      // First call: delete character
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "delete-player-character",
        characterId: "char-1",
      });

      // Fast-forward timers to trigger setTimeout
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(alertSpy).toHaveBeenCalledWith("You have no characters. Please create a new one.");
      expect(promptSpy).toHaveBeenCalledWith("Enter character name:", "New Character");
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "add-player-character",
        name: "New Hero",
        maxHp: 100,
      });

      confirmSpy.mockRestore();
      alertSpy.mockRestore();
      promptSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe("Complex Player State Application", () => {
    it("should apply basic player state (name, HP, portrait)", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        portrait: "https://example.com/gandalf.png",
      };

      act(() => {
        result.current.applyPlayerState(playerState);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "rename",
        name: "Gandalf",
      });
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-hp",
        hp: 80,
        maxHp: 120,
      });
      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "portrait",
        data: "https://example.com/gandalf.png",
      });
    });

    it("should handle null portrait gracefully", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        portrait: null,
      };

      act(() => {
        result.current.applyPlayerState(playerState);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "portrait",
        data: "",
      });
    });

    it("should apply status effects if present", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        statusEffects: ["Blessed", "Hasted"],
      };

      act(() => {
        result.current.applyPlayerState(playerState);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-status-effects",
        effects: ["Blessed", "Hasted"],
      });
    });

    it("should apply token color when tokenId provided", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        token: {
          color: "#FF0000",
        },
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-token-color",
        tokenId: "token-1",
        color: "#FF0000",
      });
    });

    it("should apply legacy color field when token.color not present", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        color: "#00FF00",
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-token-color",
        tokenId: "token-1",
        color: "#00FF00",
      });
    });

    it("should apply token image URL", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        token: {
          imageUrl: "https://example.com/token.png",
        },
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-token-image",
        tokenId: "token-1",
        imageUrl: "https://example.com/token.png",
      });
    });

    it("should apply legacy tokenImage field", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        tokenImage: "https://example.com/legacy-token.png",
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "update-token-image",
        tokenId: "token-1",
        imageUrl: "https://example.com/legacy-token.png",
      });
    });

    it("should apply token size", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        token: {
          size: "large",
        },
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-token-size",
        tokenId: "token-1",
        size: "large",
      });
    });

    it("should apply token transform (position, scale, rotation)", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        token: {
          position: { x: 100, y: 200 },
          scale: { x: 1.5, y: 1.5 },
          rotation: 45,
        },
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "token:token-1",
        position: { x: 100, y: 200 },
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
      });
    });

    it("should clamp token scale between 0.1 and 10", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        token: {
          scale: { x: 15, y: 0.05 },
        },
      };

      act(() => {
        result.current.applyPlayerState(playerState, "token-1");
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "transform-object",
        id: "token:token-1",
        scale: { x: 10, y: 0.1 },
      });
    });

    it("should sync player drawings", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const playerState: PlayerState = {
        name: "Gandalf",
        hp: 80,
        maxHp: 120,
        drawings: [
          {
            id: "drawing-1",
            uid: "player-1",
            points: [10, 20, 30, 40],
            color: "red",
            brushSize: 5,
            tool: "pen",
          },
        ],
      };

      act(() => {
        result.current.applyPlayerState(playerState);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "sync-player-drawings",
        drawings: playerState.drawings,
      });
    });
  });

  describe("Player Staging Zone", () => {
    it("should set player staging zone", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      const zone: PlayerStagingZone = {
        x: 100,
        y: 200,
        width: 300,
        height: 400,
        rotation: 0,
      };

      act(() => {
        result.current.setPlayerStagingZone(zone);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-player-staging-zone",
        zone,
      });
    });

    it("should clear player staging zone when undefined", () => {
      const { result } = renderHook(() =>
        usePlayerActions({
          sendMessage: mockSendMessage,
          snapshot: mockSnapshot,
          uid: "player-1",
        }),
      );

      act(() => {
        result.current.setPlayerStagingZone(undefined);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        t: "set-player-staging-zone",
        zone: undefined,
      });
    });
  });
});
