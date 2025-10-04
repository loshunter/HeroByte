import { describe, expect, it } from "vitest";
import { validateMessage } from "../validation.js";
import type { ClientMessage } from "@shared";

const baseDrawing = {
  id: "drawing-1",
  type: "freehand" as const,
  points: [{ x: 0, y: 0 }],
  color: "#ffffff",
  width: 4,
  opacity: 1,
};

const baseRoll = {
  id: "roll-1",
  playerUid: "uid-1",
  playerName: "Player 1",
  formula: "1d20",
  total: 15,
  breakdown: [
    {
      tokenId: "token-1",
      die: "d20",
      rolls: [15],
      subtotal: 15,
    },
  ],
  timestamp: Date.now(),
};

describe("validateMessage", () => {
  it("accepts all supported message variations", () => {
    const validMessages = [
      { t: "move", id: "token-1", x: 10, y: 15 },
      { t: "recolor", id: "token-1" },
      { t: "delete-token", id: "token-1" },
      { t: "portrait", data: "data:image/png;base64,AAA" },
      { t: "rename", name: "New Name" },
      { t: "mic-level", level: 0.5 },
      { t: "set-hp", hp: 20, maxHp: 30 },
      { t: "create-character", name: "Ayla", maxHp: 45, portrait: "img" },
      { t: "claim-character", characterId: "char-1" },
      { t: "update-character-hp", characterId: "char-1", hp: 10, maxHp: 20 },
      { t: "link-token", characterId: "char-1", tokenId: "token-1" },
      { t: "map-background", data: "data:image/png;base64,BBB" },
      { t: "grid-size", size: 50 },
      { t: "point", x: 1, y: 2 },
      { t: "draw", drawing: baseDrawing },
      { t: "undo-drawing" },
      { t: "redo-drawing" },
      { t: "clear-drawings" },
      { t: "select-drawing", id: "drawing-1" },
      { t: "deselect-drawing" },
      { t: "move-drawing", id: "drawing-1", dx: 5, dy: -3 },
      { t: "delete-drawing", id: "drawing-1" },
      { t: "dice-roll", roll: baseRoll },
      { t: "clear-roll-history" },
      { t: "clear-all-tokens" },
      { t: "heartbeat" },
      {
        t: "load-session",
        snapshot: {
          users: [],
          tokens: [],
          players: [],
          characters: [],
          mapBackground: undefined,
          pointers: [],
          drawings: [],
          gridSize: 50,
          diceRolls: [],
        },
      },
      { t: "rtc-signal", target: "uid-2", signal: { type: "offer" } },
    ];

    for (const message of validMessages) {
      expect(validateMessage(message)).toEqual({ valid: true });
    }
  });

  it("rejects unknown message types", () => {
    expect(validateMessage({})).toEqual({ valid: false, error: "Missing or invalid message type" });
    expect(validateMessage({ t: "unknown" })).toEqual({
      valid: false,
      error: "Unknown message type: unknown",
    });
  });

  it("enforces required fields and ranges", () => {
    expect(validateMessage({ t: "move", id: "a", x: Number.NaN, y: 0 })).toMatchObject({
      valid: false,
    });
    expect(validateMessage({ t: "rename", name: "" })).toMatchObject({ valid: false });
    expect(validateMessage({ t: "grid-size", size: 5 })).toMatchObject({ valid: false });
    expect(validateMessage({ t: "mic-level", level: 1.5 })).toMatchObject({ valid: false });
    const invalidMoveDrawing = {
      t: "move-drawing",
      id: "draw",
      dx: "1",
      dy: 0,
    } as unknown as ClientMessage;
    expect(validateMessage(invalidMoveDrawing)).toMatchObject({ valid: false });
  });

  it("enforces payload size limits", () => {
    const largePortrait = "p".repeat(2 * 1024 * 1024 + 1);
    expect(validateMessage({ t: "portrait", data: largePortrait })).toMatchObject({
      valid: false,
      error: "portrait: data too large (max 2MB)",
    });

    const largeBackground = "b".repeat(10 * 1024 * 1024 + 1);
    expect(validateMessage({ t: "map-background", data: largeBackground })).toMatchObject({
      valid: false,
      error: "map-background: data too large (max 10MB)",
    });
  });

  it("validates drawing structure and complexity", () => {
    const invalidDrawingMessage = {
      t: "draw",
      drawing: { id: "missing", type: "freehand" },
    } as unknown as ClientMessage;
    expect(validateMessage(invalidDrawingMessage)).toMatchObject({ valid: false });

    const tooManyPoints = {
      ...baseDrawing,
      points: Array.from({ length: 10001 }, (_, idx) => ({ x: idx, y: idx })),
    };

    expect(validateMessage({ t: "draw", drawing: tooManyPoints })).toMatchObject({
      valid: false,
      error: "draw: too many points (max 10000)",
    });
  });

  it("validates load-session snapshot structure", () => {
    const result = validateMessage({
      t: "load-session",
      snapshot: { tokens: {}, players: [], drawings: [] },
    });

    expect(result).toMatchObject({ valid: false });
  });
});
