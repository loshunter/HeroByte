import { describe, expect, it } from "vitest";
import { DiceService } from "../dice/service.js";
import { createEmptyRoomState } from "../room/model.js";

const createRoll = (id: number) => ({
  id: `roll-${id}`,
  playerUid: "uid-1",
  playerName: "Player",
  formula: "1d20",
  total: id,
  breakdown: [{ tokenId: "token-1", die: "d20", rolls: [id], subtotal: id }],
  timestamp: id,
});

describe("DiceService", () => {
  const service = new DiceService();

  it("adds rolls and trims history beyond the maximum", () => {
    const state = createEmptyRoomState();

    for (let i = 0; i < 105; i++) {
      service.addRoll(state, createRoll(i));
    }

    expect(state.diceRolls).toHaveLength(100);
    expect(state.diceRolls[0]?.id).toBe("roll-5");
  });

  it("clears and retrieves history", () => {
    const state = createEmptyRoomState();
    service.addRoll(state, createRoll(1));
    expect(service.getHistory(state)).toHaveLength(1);

    service.clearHistory(state);
    expect(service.getHistory(state)).toHaveLength(0);
  });

  it("handles complex dice formula with multiple dice types and modifiers", () => {
    // Test that service correctly stores a roll with complex breakdown
    const state = createEmptyRoomState();
    const complexRoll = {
      id: "roll-complex",
      playerUid: "uid-1",
      playerName: "Player",
      formula: "2d6+3d8+5",
      total: 35,
      breakdown: [
        { tokenId: "token-1", die: "d6", rolls: [4, 5], subtotal: 9 },
        { tokenId: "token-2", die: "d8", rolls: [7, 6, 8], subtotal: 21 },
        { tokenId: "token-3", subtotal: 5 },
      ],
      timestamp: Date.now(),
    };

    service.addRoll(state, complexRoll);
    const history = service.getHistory(state);

    expect(history).toHaveLength(1);
    expect(history[0]?.formula).toBe("2d6+3d8+5");
    expect(history[0]?.breakdown).toHaveLength(3);
    expect(history[0]?.breakdown[0]?.rolls).toEqual([4, 5]);
    expect(history[0]?.breakdown[1]?.rolls).toEqual([7, 6, 8]);
  });

  it("verifies roll total matches sum of breakdown subtotals", () => {
    // Test roll data integrity - total should equal sum of all subtotals
    const state = createEmptyRoomState();
    const breakdown = [
      { tokenId: "token-1", die: "d20", rolls: [15], subtotal: 15 },
      { tokenId: "token-2", subtotal: 5 },
      { tokenId: "token-3", die: "d4", rolls: [3], subtotal: 3 },
    ];
    const expectedTotal = breakdown.reduce(
      (sum, part) => sum + part.subtotal,
      0,
    );

    const roll = {
      id: "roll-calculated",
      playerUid: "uid-1",
      playerName: "Player",
      formula: "1d20+5+1d4",
      total: expectedTotal,
      breakdown,
      timestamp: Date.now(),
    };

    service.addRoll(state, roll);
    const retrievedRoll = service.getHistory(state)[0];

    expect(retrievedRoll?.total).toBe(23);
    expect(retrievedRoll?.total).toBe(expectedTotal);
  });

  it("retrieves roll history in correct order with multiple rolls", () => {
    // Test that rolls are stored and retrieved in chronological order
    const state = createEmptyRoomState();
    const rolls = [
      createRoll(1),
      createRoll(2),
      createRoll(3),
      createRoll(4),
      createRoll(5),
    ];

    rolls.forEach((roll) => service.addRoll(state, roll));
    const history = service.getHistory(state);

    expect(history).toHaveLength(5);
    // Verify rolls are in the order they were added (oldest to newest)
    expect(history[0]?.id).toBe("roll-1");
    expect(history[1]?.id).toBe("roll-2");
    expect(history[2]?.id).toBe("roll-3");
    expect(history[3]?.id).toBe("roll-4");
    expect(history[4]?.id).toBe("roll-5");
  });

  it("handles edge case with minimum roll values", () => {
    // Test handling of minimum possible roll (all 1s)
    const state = createEmptyRoomState();
    const minRoll = {
      id: "roll-min",
      playerUid: "uid-1",
      playerName: "Player",
      formula: "3d20",
      total: 3,
      breakdown: [
        { tokenId: "token-1", die: "d20", rolls: [1, 1, 1], subtotal: 3 },
      ],
      timestamp: Date.now(),
    };

    service.addRoll(state, minRoll);
    const history = service.getHistory(state);

    expect(history).toHaveLength(1);
    expect(history[0]?.total).toBe(3);
    expect(history[0]?.breakdown[0]?.rolls).toEqual([1, 1, 1]);
  });

  it("handles edge case with maximum roll values", () => {
    // Test handling of maximum possible roll (all max values)
    const state = createEmptyRoomState();
    const maxRoll = {
      id: "roll-max",
      playerUid: "uid-1",
      playerName: "Player",
      formula: "4d6",
      total: 24,
      breakdown: [
        { tokenId: "token-1", die: "d6", rolls: [6, 6, 6, 6], subtotal: 24 },
      ],
      timestamp: Date.now(),
    };

    service.addRoll(state, maxRoll);
    const history = service.getHistory(state);

    expect(history).toHaveLength(1);
    expect(history[0]?.total).toBe(24);
    expect(history[0]?.breakdown[0]?.rolls).toEqual([6, 6, 6, 6]);
  });

  it("maintains correct state when adding multiple rolls rapidly", () => {
    // Test concurrent-like behavior - rapid successive roll additions
    const state = createEmptyRoomState();
    const rollCount = 50;
    const rolls = Array.from({ length: rollCount }, (_, i) => createRoll(i));

    // Add all rolls in rapid succession
    rolls.forEach((roll) => service.addRoll(state, roll));

    const history = service.getHistory(state);

    // Verify all rolls were added
    expect(history).toHaveLength(rollCount);

    // Verify no data corruption - each roll has correct id
    history.forEach((roll, index) => {
      expect(roll.id).toBe(`roll-${index}`);
    });

    // Verify state integrity - no duplicates
    const uniqueIds = new Set(history.map((roll) => roll.id));
    expect(uniqueIds.size).toBe(rollCount);
  });
});
