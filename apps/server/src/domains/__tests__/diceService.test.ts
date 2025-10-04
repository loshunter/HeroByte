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
});
