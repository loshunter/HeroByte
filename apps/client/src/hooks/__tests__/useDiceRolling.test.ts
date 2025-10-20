/**
 * Characterization tests for useDiceRolling hook
 *
 * These tests capture the behavior of the original dice rolling code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 14-17, 59-62, 228-230, 235-249, 1017-1078)
 * Target: apps/client/src/hooks/useDiceRolling.ts
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDiceRolling } from "../useDiceRolling.js";
import type { RoomSnapshot, Player, DiceRoll, ClientMessage } from "@shared";
import type { RollResult, DieType } from "../../components/dice/types.js";

describe("useDiceRolling - Characterization", () => {
  const mockUid = "test-player-uid";
  const mockSendMessage = vi.fn();

  const createMockSnapshot = (diceRolls: DiceRoll[] = [], players: Player[] = []): RoomSnapshot => ({
    players,
    characters: [],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    mapBackground: undefined,
    playerStagingZone: undefined,
    gridSize: 50,
    gridSquareSize: 5,
    diceRolls,
    props: [],
    dmPassword: undefined,
    dmPasswordUpdatedAt: undefined,
    roomSecret: "test-secret",
    roomSecretUpdatedAt: Date.now(),
    roomSecretSource: "env",
  });

  const createMockPlayer = (uid: string, name: string): Player => ({
    uid,
    name,
    hp: 100,
    maxHp: 100,
  });

  describe("State Management", () => {
    it("should initialize with all panels closed and no viewing roll", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      expect(result.current.diceRollerOpen).toBe(false);
      expect(result.current.rollLogOpen).toBe(false);
      expect(result.current.viewingRoll).toBe(null);
    });

    it("should toggle dice roller open state", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      act(() => {
        result.current.toggleDiceRoller(true);
      });

      expect(result.current.diceRollerOpen).toBe(true);

      act(() => {
        result.current.toggleDiceRoller(false);
      });

      expect(result.current.diceRollerOpen).toBe(false);
    });

    it("should toggle roll log open state", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      act(() => {
        result.current.toggleRollLog(true);
      });

      expect(result.current.rollLogOpen).toBe(true);

      act(() => {
        result.current.toggleRollLog(false);
      });

      expect(result.current.rollLogOpen).toBe(false);
    });

    it("should set and clear viewing roll", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const mockRoll: RollResult = {
        id: "roll-1",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleViewRoll(mockRoll);
      });

      expect(result.current.viewingRoll).toEqual(mockRoll);

      act(() => {
        result.current.handleViewRoll(null);
      });

      expect(result.current.viewingRoll).toBe(null);
    });
  });

  describe("Roll History Transformation", () => {
    it("should transform empty dice rolls array to empty roll history", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([]),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      expect(result.current.rollHistory).toEqual([]);
    });

    it("should transform dice rolls from snapshot to roll history format", () => {
      const mockDiceRolls: DiceRoll[] = [
        {
          id: "roll-1",
          playerUid: "player-1",
          playerName: "Alice",
          formula: "2d20 + 5",
          total: 30,
          breakdown: [
            { tokenId: "t1", die: "d20", rolls: [15, 10], subtotal: 25 },
            { tokenId: "t2", subtotal: 5 },
          ],
          timestamp: 1234567890,
        },
      ];

      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(mockDiceRolls),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      expect(result.current.rollHistory).toHaveLength(1);
      expect(result.current.rollHistory[0]).toEqual({
        id: "roll-1",
        playerName: "Alice",
        tokens: [],
        perDie: [
          { tokenId: "t1", die: "d20", rolls: [15, 10], subtotal: 25 },
          { tokenId: "t2", die: undefined, rolls: undefined, subtotal: 5 },
        ],
        total: 30,
        timestamp: 1234567890,
      });
    });

    it("should cast die field to DieType in breakdown transformation", () => {
      const mockDiceRolls: DiceRoll[] = [
        {
          id: "roll-1",
          playerUid: "player-1",
          playerName: "Bob",
          formula: "1d6",
          total: 4,
          breakdown: [{ tokenId: "t1", die: "d6", rolls: [4], subtotal: 4 }],
          timestamp: 1234567890,
        },
      ];

      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(mockDiceRolls),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const perDie = result.current.rollHistory[0].perDie[0];
      expect(perDie.die).toBe("d6");
    });

    it("should update roll history when snapshot changes", () => {
      const { result, rerender } = renderHook(
        ({ snapshot }) =>
          useDiceRolling({
            snapshot,
            sendMessage: mockSendMessage,
            uid: mockUid,
          }),
        {
          initialProps: {
            snapshot: createMockSnapshot([]),
          },
        },
      );

      expect(result.current.rollHistory).toHaveLength(0);

      const newSnapshot = createMockSnapshot([
        {
          id: "roll-1",
          playerUid: "player-1",
          playerName: "Charlie",
          formula: "1d20",
          total: 15,
          breakdown: [{ tokenId: "t1", die: "d20", rolls: [15], subtotal: 15 }],
          timestamp: 1234567890,
        },
      ]);

      rerender({ snapshot: newSnapshot });

      expect(result.current.rollHistory).toHaveLength(1);
    });

    it("should handle null snapshot gracefully", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      expect(result.current.rollHistory).toEqual([]);
    });
  });

  describe("Roll Handler - Formula Generation", () => {
    it("should send dice-roll message with correct formula for single die", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-1",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      expect(message.t).toBe("dice-roll");
      if (message.t === "dice-roll") {
        expect(message.roll.formula).toBe("d20");
      }
    });

    it("should send dice-roll message with correct formula for multiple dice (qty > 1)", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-2",
        tokens: [{ kind: "die", die: "d6", qty: 3, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d6", rolls: [3, 4, 5], subtotal: 12 }],
        total: 12,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.formula).toBe("3d6");
      }
    });

    it("should send dice-roll message with positive modifier formatted correctly", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-3",
        tokens: [
          { kind: "die", die: "d20", qty: 1, id: "token-1" },
          { kind: "mod", value: 5, id: "token-2" },
        ],
        perDie: [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", subtotal: 5 },
        ],
        total: 20,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.formula).toBe("d20 +5");
      }
    });

    it("should send dice-roll message with negative modifier formatted correctly", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-4",
        tokens: [
          { kind: "die", die: "d20", qty: 1, id: "token-1" },
          { kind: "mod", value: -3, id: "token-2" },
        ],
        perDie: [
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
          { tokenId: "token-2", subtotal: -3 },
        ],
        total: 12,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.formula).toBe("d20 -3");
      }
    });

    it("should send dice-roll message with complex formula (multiple dice + modifiers)", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-5",
        tokens: [
          { kind: "die", die: "d20", qty: 2, id: "token-1" },
          { kind: "mod", value: 5, id: "token-2" },
          { kind: "die", die: "d6", qty: 1, id: "token-3" },
        ],
        perDie: [
          { tokenId: "token-1", die: "d20", rolls: [10, 15], subtotal: 25 },
          { tokenId: "token-2", subtotal: 5 },
          { tokenId: "token-3", die: "d6", rolls: [4], subtotal: 4 },
        ],
        total: 34,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.formula).toBe("2d20 +5 d6");
      }
    });

    it("should use player name from snapshot when available", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "Alice")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-6",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.playerName).toBe("Alice");
      }
    });

    it("should use 'Unknown' as player name when player not found in snapshot", () => {
      const mockSendMessage = vi.fn();
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], []),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-7",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.playerName).toBe("Unknown");
      }
    });

    it("should use 'Unknown' as player name when snapshot is null", () => {
      const mockSendMessage = vi.fn();
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-8",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.playerName).toBe("Unknown");
      }
    });

    it("should send dice-roll message with correct breakdown structure", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-9",
        tokens: [{ kind: "die", die: "d20", qty: 1, id: "token-1" }],
        perDie: [{ tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 }],
        total: 15,
        timestamp: 12345,
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.breakdown).toEqual([
          { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
        ]);
        expect(message.roll.total).toBe(15);
        expect(message.roll.timestamp).toBe(12345);
        expect(message.roll.playerUid).toBe(mockUid);
      }
    });
  });

  describe("Clear Log Handler", () => {
    it("should send clear-roll-history message when handleClearLog is called", () => {
      const mockSendMessage = vi.fn();
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      act(() => {
        result.current.handleClearLog();
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "clear-roll-history" });
    });
  });

  describe("Callback Stability", () => {
    it("should maintain callback stability across re-renders", () => {
      const { result, rerender } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const initialToggleDiceRoller = result.current.toggleDiceRoller;
      const initialToggleRollLog = result.current.toggleRollLog;
      const initialHandleRoll = result.current.handleRoll;
      const initialHandleClearLog = result.current.handleClearLog;
      const initialHandleViewRoll = result.current.handleViewRoll;

      rerender();

      expect(result.current.toggleDiceRoller).toBe(initialToggleDiceRoller);
      expect(result.current.toggleRollLog).toBe(initialToggleRollLog);
      expect(result.current.handleRoll).toBe(initialHandleRoll);
      expect(result.current.handleClearLog).toBe(initialHandleClearLog);
      expect(result.current.handleViewRoll).toBe(initialHandleViewRoll);
    });
  });

  describe("Edge Cases", () => {
    it("should handle roll result with zero total", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-10",
        tokens: [{ kind: "mod", value: 0, id: "token-1" }],
        perDie: [{ tokenId: "token-1", subtotal: 0 }],
        total: 0,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it("should handle roll result with empty tokens array", () => {
      const mockSendMessage = vi.fn();
      const players = [createMockPlayer(mockUid, "TestPlayer")];
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot([], players),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      const rollResult: RollResult = {
        id: "roll-11",
        tokens: [],
        perDie: [],
        total: 0,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleRoll(rollResult);
      });

      const message = mockSendMessage.mock.calls[0][0] as ClientMessage;
      if (message.t === "dice-roll") {
        expect(message.roll.formula).toBe("");
      }
    });

    it("should handle multiple consecutive toggle calls", () => {
      const { result } = renderHook(() =>
        useDiceRolling({
          snapshot: createMockSnapshot(),
          sendMessage: mockSendMessage,
          uid: mockUid,
        }),
      );

      act(() => {
        result.current.toggleDiceRoller(true);
        result.current.toggleDiceRoller(false);
        result.current.toggleDiceRoller(true);
      });

      expect(result.current.diceRollerOpen).toBe(true);
    });
  });
});
