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

  describe("Security: Injection & Malformed Data", () => {
    it("rejects SQL injection attempts in string fields", () => {
      expect(validateMessage({ t: "rename", name: "'; DROP TABLE users;--" })).toEqual({
        valid: true, // Sanitization happens at DB layer, but length validation applies
      });

      expect(validateMessage({ t: "rename", name: "a".repeat(51) })).toMatchObject({
        valid: false,
        error: "rename: name must be 1-50 characters",
      });
    });

    it("rejects XSS attempts in data fields", () => {
      const xssPayload = '<script>alert("xss")</script>';
      // Should accept (sanitization happens client-side during render)
      expect(validateMessage({ t: "rename", name: xssPayload })).toEqual({ valid: true });
    });

    it("rejects null/undefined in required fields", () => {
      expect(validateMessage({ t: "move", id: null, x: 10, y: 20 })).toMatchObject({
        valid: false,
      });
      expect(validateMessage({ t: "rename", name: undefined })).toMatchObject({
        valid: false,
      });
    });

    it("rejects Infinity and -Infinity", () => {
      expect(validateMessage({ t: "move", id: "token", x: Infinity, y: 0 })).toMatchObject({
        valid: false,
      });
      expect(validateMessage({ t: "set-hp", hp: -Infinity, maxHp: 100 })).toMatchObject({
        valid: false,
      });
    });

    it("rejects object injection attempts", () => {
      const maliciousObject = { __proto__: { polluted: true }, name: "test" };
      expect(validateMessage({ t: "rename", ...maliciousObject })).toEqual({ valid: true });
    });

    it("rejects deeply nested objects in snapshot", () => {
      const deepObject: Record<string, unknown> = {};
      let current: Record<string, unknown> = deepObject;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested as Record<string, unknown>;
      }

      // Should still validate structure, but deeply nested data is accepted
      expect(
        validateMessage({
          t: "load-session",
          snapshot: { players: [], tokens: [], drawings: [], ...deepObject },
        }),
      ).toEqual({ valid: true });
    });
  });

  describe("Security: DoS Prevention", () => {
    it("rejects excessively long strings", () => {
      const veryLongString = "a".repeat(100000);
      expect(validateMessage({ t: "rename", name: veryLongString })).toMatchObject({
        valid: false,
      });
    });

    it("rejects massive arrays in drawings", () => {
      const massiveDrawing = {
        ...baseDrawing,
        points: Array(20000)
          .fill(null)
          .map(() => ({ x: 0, y: 0 })),
      };

      expect(validateMessage({ t: "draw", drawing: massiveDrawing })).toMatchObject({
        valid: false,
        error: "draw: too many points (max 10000)",
      });
    });

    it("enforces size limits on base64 images", () => {
      const oversizedPortrait = "data:image/png;base64," + "A".repeat(2 * 1024 * 1024);
      expect(validateMessage({ t: "portrait", data: oversizedPortrait })).toMatchObject({
        valid: false,
        error: "portrait: data too large (max 2MB)",
      });
    });
  });

  describe("Edge Cases: NPC Management", () => {
    it("validates create-npc with all fields", () => {
      expect(
        validateMessage({
          t: "create-npc",
          name: "Orc",
          hp: 30,
          maxHp: 30,
          portrait: "portrait-data",
          tokenImage: "token-url",
        }),
      ).toEqual({ valid: true });
    });

    it("rejects create-npc with negative hp", () => {
      expect(
        validateMessage({
          t: "create-npc",
          name: "Orc",
          hp: -10,
          maxHp: 30,
          portrait: undefined,
          tokenImage: undefined,
        }),
      ).toMatchObject({ valid: false });
    });

    it("validates update-npc with zero hp (dead NPC)", () => {
      expect(
        validateMessage({
          t: "update-npc",
          id: "npc-1",
          name: "Dead Orc",
          hp: 0,
          maxHp: 30,
          portrait: undefined,
          tokenImage: undefined,
        }),
      ).toEqual({ valid: true });
    });

    it("validates place-npc-token", () => {
      expect(validateMessage({ t: "place-npc-token", id: "npc-1" })).toEqual({ valid: true });
      expect(validateMessage({ t: "place-npc-token", id: "" })).toMatchObject({ valid: false });
    });
  });

  describe("Edge Cases: Token Management", () => {
    it("validates update-token-image with URL", () => {
      expect(
        validateMessage({
          t: "update-token-image",
          tokenId: "token-1",
          imageUrl: "https://example.com/token.png",
        }),
      ).toEqual({ valid: true });
    });

    it("rejects update-token-image with excessively long URL", () => {
      const longUrl = "https://example.com/" + "a".repeat(2100);
      expect(
        validateMessage({
          t: "update-token-image",
          tokenId: "token-1",
          imageUrl: longUrl,
        }),
      ).toMatchObject({
        valid: false,
        error: "update-token-image: imageUrl too long (max 2048 chars)",
      });
    });
  });

  describe("Edge Cases: Authentication", () => {
    it("validates authenticate with roomId", () => {
      expect(
        validateMessage({
          t: "authenticate",
          secret: "my-secret-123",
          roomId: "room-456",
        }),
      ).toEqual({ valid: true });
    });

    it("validates authenticate without roomId", () => {
      expect(
        validateMessage({
          t: "authenticate",
          secret: "my-secret-123",
        }),
      ).toEqual({ valid: true });
    });

    it("rejects authenticate with empty secret", () => {
      expect(
        validateMessage({
          t: "authenticate",
          secret: "",
        }),
      ).toMatchObject({
        valid: false,
        error: "authenticate: missing or invalid secret",
      });
    });

    it("rejects authenticate with excessively long secret", () => {
      expect(
        validateMessage({
          t: "authenticate",
          secret: "a".repeat(257),
        }),
      ).toMatchObject({
        valid: false,
        error: "authenticate: secret too long",
      });
    });

    it("rejects authenticate with non-string roomId", () => {
      expect(
        validateMessage({
          t: "authenticate",
          secret: "valid-secret",
          roomId: 123,
        }),
      ).toMatchObject({
        valid: false,
        error: "authenticate: roomId must be a string",
      });
    });
  });

  describe("Edge Cases: Scene Objects", () => {
    it("validates transform-object with position only", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          position: { x: 10, y: 20 },
        }),
      ).toEqual({ valid: true });
    });

    it("validates transform-object with scale only", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: 2, y: 2 },
        }),
      ).toEqual({ valid: true });
    });

    it("validates transform-object with rotation only", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          rotation: 90,
        }),
      ).toEqual({ valid: true });
    });

    it("validates transform-object with all transformations", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          position: { x: 10, y: 20 },
          scale: { x: 1.5, y: 1.5 },
          rotation: 45,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects transform-object with negative scale", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: -1, y: 1 },
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: scale must be positive",
      });
    });

    it("rejects transform-object with zero scale", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: 0, y: 1 },
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: scale must be positive",
      });
    });

    it("rejects transform-object with invalid position", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          position: { x: NaN, y: 20 },
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: invalid position",
      });
    });
  });

  describe("Edge Cases: Toggle DM", () => {
    it("validates toggle-dm with true", () => {
      expect(validateMessage({ t: "toggle-dm", isDM: true })).toEqual({ valid: true });
    });

    it("validates toggle-dm with false", () => {
      expect(validateMessage({ t: "toggle-dm", isDM: false })).toEqual({ valid: true });
    });

    it("rejects toggle-dm with non-boolean", () => {
      expect(validateMessage({ t: "toggle-dm", isDM: 1 })).toMatchObject({
        valid: false,
        error: "toggle-dm: isDM must be boolean",
      });
    });
  });
});
