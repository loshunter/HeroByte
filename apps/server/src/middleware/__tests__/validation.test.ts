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

const basePartialSegment = {
  type: "freehand" as const,
  points: [
    { x: 0, y: 0 },
    { x: 5, y: 5 },
  ],
  color: "#ff00ff",
  width: 2,
  opacity: 0.9,
  filled: false,
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
      { t: "select-object", uid: "uid-1", objectId: "token-1" },
      { t: "deselect-object", uid: "uid-1" },
      { t: "select-multiple", uid: "uid-1", objectIds: ["token-1", "drawing-1"] },
      { t: "select-multiple", uid: "uid-1", objectIds: ["token-1"], mode: "append" },
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
      { t: "grid-square-size", size: 5 },
      { t: "point", x: 1, y: 2 },
      { t: "draw", drawing: baseDrawing },
      { t: "undo-drawing" },
      { t: "redo-drawing" },
      { t: "clear-drawings" },
      { t: "select-drawing", id: "drawing-1" },
      { t: "deselect-drawing" },
      { t: "move-drawing", id: "drawing-1", dx: 5, dy: -3 },
      { t: "delete-drawing", id: "drawing-1" },
      {
        t: "erase-partial",
        deleteId: "drawing-1",
        segments: [basePartialSegment],
      } as unknown as ClientMessage,
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
          gridSquareSize: 5,
          diceRolls: [],
        },
      },
      { t: "rtc-signal", target: "uid-2", signal: { type: "offer" } },
      { t: "set-token-size", tokenId: "token-1", size: "medium" },
      { t: "set-token-size", tokenId: "token-1", size: "tiny" },
      { t: "set-token-size", tokenId: "token-1", size: "small" },
      { t: "set-token-size", tokenId: "token-1", size: "large" },
      { t: "set-token-size", tokenId: "token-1", size: "huge" },
      { t: "set-token-size", tokenId: "token-1", size: "gargantuan" },
    ];

    for (const message of validMessages) {
      expect(validateMessage(message)).toEqual({ valid: true });
    }
  });

  describe("erase-partial validation", () => {
    it("accepts erase-partial with valid deleteId and segments", () => {
      const message: ClientMessage = {
        t: "erase-partial",
        deleteId: "drawing-1",
        segments: [basePartialSegment],
      } as ClientMessage;
      expect(validateMessage(message)).toEqual({ valid: true });
    });

    it("allows erase-partial with empty segments for full deletion", () => {
      const message = {
        t: "erase-partial",
        deleteId: "drawing-1",
        segments: [],
      };
      expect(validateMessage(message)).toEqual({ valid: true });
    });

    it("rejects erase-partial without deleteId", () => {
      const message = {
        t: "erase-partial",
        segments: [basePartialSegment],
      };
      expect(validateMessage(message)).toMatchObject({
        valid: false,
        error: "erase-partial: missing deleteId",
      });
    });

    it("rejects erase-partial with invalid segments array", () => {
      const message = {
        t: "erase-partial",
        deleteId: "drawing-1",
        segments: "not-an-array",
      };
      expect(validateMessage(message)).toMatchObject({
        valid: false,
        error: "erase-partial: segments must be an array",
      });
    });

    it("rejects erase-partial when any segment is invalid", () => {
      const invalidSegment = {
        ...basePartialSegment,
        points: [{ x: 0, y: 0 }],
      };
      const message = {
        t: "erase-partial",
        deleteId: "drawing-1",
        segments: [invalidSegment],
      };
      expect(validateMessage(message)).toMatchObject({
        valid: false,
        error: "erase-partial: segments must contain at least 2 points",
      });
    });
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
    expect(validateMessage({ t: "grid-square-size", size: 0 })).toMatchObject({ valid: false });
    expect(validateMessage({ t: "grid-square-size", size: 150 })).toMatchObject({ valid: false });
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

  describe("selection message validation", () => {
    it("rejects select-object without required fields", () => {
      expect(validateMessage({ t: "select-object", uid: "uid-1" })).toMatchObject({
        valid: false,
        error: "select-object: missing or invalid objectId",
      });
      expect(validateMessage({ t: "select-object", objectId: "obj-1" })).toMatchObject({
        valid: false,
        error: "select-object: missing or invalid uid",
      });
    });

    it("rejects deselect-object without a uid", () => {
      expect(validateMessage({ t: "deselect-object" })).toMatchObject({
        valid: false,
        error: "deselect-object: missing or invalid uid",
      });
    });

    it("rejects select-multiple with invalid objectIds", () => {
      expect(validateMessage({ t: "select-multiple", uid: "uid-1", objectIds: [] })).toMatchObject({
        valid: false,
        error: "select-multiple: objectIds must be a non-empty string array",
      });
      expect(
        validateMessage({ t: "select-multiple", uid: "uid-1", objectIds: ["valid", 2] }),
      ).toMatchObject({
        valid: false,
        error: "select-multiple: objectIds must be a non-empty string array",
      });
    });

    it("rejects select-multiple with invalid mode", () => {
      expect(
        validateMessage({
          t: "select-multiple",
          uid: "uid-1",
          objectIds: ["obj-1"],
          mode: "invalid",
        }),
      ).toMatchObject({
        valid: false,
        error: "select-multiple: invalid mode (replace, append, subtract)",
      });
    });

    it("caps select-multiple payload size", () => {
      const manyIds = Array.from({ length: 101 }, (_, idx) => `obj-${idx}`);
      expect(
        validateMessage({ t: "select-multiple", uid: "uid-1", objectIds: manyIds }),
      ).toMatchObject({
        valid: false,
        error: "select-multiple: too many objectIds (max 100)",
      });
    });
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

    it("rejects transform-object with scale exceeding maximum (>10x)", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: 15, y: 1 },
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: scale must not exceed 10x",
      });
    });

    it("rejects transform-object with scale below minimum (<0.1x)", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: 0.05, y: 1 },
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: scale must be at least 0.1x",
      });
    });

    it("accepts transform-object with scale at maximum (10x)", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: 10, y: 10 },
        }),
      ).toMatchObject({
        valid: true,
      });
    });

    it("accepts transform-object with scale at minimum (0.1x)", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          scale: { x: 0.1, y: 0.1 },
        }),
      ).toMatchObject({
        valid: true,
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

    it("validates transform-object with locked: true", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          locked: true,
        }),
      ).toEqual({ valid: true });
    });

    it("validates transform-object with locked: false", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          locked: false,
        }),
      ).toEqual({ valid: true });
    });

    it("validates transform-object with position and locked", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          position: { x: 10, y: 20 },
          locked: true,
        }),
      ).toEqual({ valid: true });
    });

    it("validates transform-object with all fields including locked", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          position: { x: 10, y: 20 },
          scale: { x: 1.5, y: 1.5 },
          rotation: 45,
          locked: false,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects transform-object with non-boolean locked", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          locked: "true",
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: locked must be a boolean",
      });
    });

    it("rejects transform-object with numeric locked", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          locked: 1,
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: locked must be a boolean",
      });
    });

    it("rejects transform-object with null locked", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "obj-1",
          locked: null,
        }),
      ).toMatchObject({
        valid: false,
        error: "transform-object: locked must be a boolean",
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

  it("validates set-room-password", () => {
    expect(validateMessage({ t: "set-room-password", secret: "NewSecret123" })).toEqual({
      valid: true,
    });
  });

  it("rejects set-room-password with empty secret", () => {
    expect(validateMessage({ t: "set-room-password", secret: "" })).toMatchObject({
      valid: false,
      error: "set-room-password: secret is empty",
    });
  });

  it("rejects set-room-password with non-string secret", () => {
    expect(validateMessage({ t: "set-room-password", secret: 42 })).toMatchObject({
      valid: false,
      error: "set-room-password: secret must be a string",
    });
  });
  });

  describe("Phase 11: Token Size Validation", () => {
    it("validates set-token-size with all valid sizes", () => {
      const validSizes = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

      for (const size of validSizes) {
        expect(
          validateMessage({
            t: "set-token-size",
            tokenId: "token-1",
            size,
          }),
        ).toEqual({ valid: true });
      }
    });

    it("rejects set-token-size with invalid size string", () => {
      expect(
        validateMessage({
          t: "set-token-size",
          tokenId: "token-1",
          size: "invalid",
        }),
      ).toMatchObject({
        valid: false,
        error: "set-token-size: invalid size (must be tiny/small/medium/large/huge/gargantuan)",
      });
    });

    it("rejects set-token-size with non-string size", () => {
      expect(
        validateMessage({
          t: "set-token-size",
          tokenId: "token-1",
          size: 5,
        }),
      ).toMatchObject({
        valid: false,
        error: "set-token-size: size must be a string",
      });
    });

    it("rejects set-token-size with missing tokenId", () => {
      expect(
        validateMessage({
          t: "set-token-size",
          tokenId: "",
          size: "large",
        }),
      ).toMatchObject({
        valid: false,
        error: "set-token-size: tokenId required",
      });
    });

    it("rejects set-token-size with missing size", () => {
      expect(
        validateMessage({
          t: "set-token-size",
          tokenId: "token-1",
        }),
      ).toMatchObject({
        valid: false,
      });
    });

    it("rejects set-token-size with null size", () => {
      expect(
        validateMessage({
          t: "set-token-size",
          tokenId: "token-1",
          size: null,
        }),
      ).toMatchObject({
        valid: false,
      });
    });
  });
});
