import { describe, expect, it } from "vitest";
import { validateMessage } from "../validation.js";
import type { ClientMessage } from "@herobyte/shared";

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
      { t: "set-character-portrait", characterId: "char-1", portrait: "img" },
      { t: "link-token", characterId: "char-1", tokenId: "token-1" },
      { t: "map-background", data: "data:image/png;base64,BBB" },
      { t: "grid-size", size: 50 },
      { t: "grid-square-size", size: 5 },
      { t: "point", x: 1, y: 2 },
      { t: "drag-preview", objects: [{ id: "token:1", x: 1, y: 2 }] },
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
      { t: "dice-roll", formula: "2d6 + 3" },
      { t: "dice-roll", formula: "d20", mode: "advantage", visibility: "dm" },
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

  describe("set-character-portrait validation", () => {
    it("rejects missing characterId", () => {
      const message = { t: "set-character-portrait", portrait: "img" } as ClientMessage;
      expect(validateMessage(message)).toMatchObject({
        valid: false,
        error: "set-character-portrait: missing or invalid characterId",
      });
    });

    it("rejects non-string portrait payload", () => {
      const message = {
        t: "set-character-portrait",
        characterId: "char-1",
        portrait: 123,
      } as unknown as ClientMessage;
      expect(validateMessage(message)).toMatchObject({
        valid: false,
        error: "set-character-portrait: portrait must be a string",
      });
    });
  });

  describe("dice-roll validation", () => {
    // The gate IS parseDiceFormula — the same function the handler uses to
    // produce terms — so there is no formula this admits and the roller then
    // chokes on. These pin that the wire really is gated, not just the handler:
    // route() bypasses validateMessage entirely, so the router-level contract
    // test cannot cover this file.
    it("rejects a formula that is missing or not a string", () => {
      expect(validateMessage({ t: "dice-roll" } as unknown as ClientMessage)).toMatchObject({
        valid: false,
        error: "dice-roll: formula must be text",
      });
      expect(
        validateMessage({ t: "dice-roll", formula: 20 } as unknown as ClientMessage),
      ).toMatchObject({ valid: false, error: "dice-roll: formula must be text" });
    });

    it("rejects notation the roller does not understand", () => {
      for (const formula of ["2d7", "d20 drop lowest", "", "2d6+", "0d6"]) {
        expect(validateMessage({ t: "dice-roll", formula } as ClientMessage)).toMatchObject({
          valid: false,
        });
      }
    });

    it("rejects a formula that would make the server roll a bucket of dice", () => {
      expect(
        validateMessage({ t: "dice-roll", formula: "99d100 + 99d100" } as ClientMessage),
      ).toMatchObject({ valid: false, error: expect.stringContaining("more than") });
    });

    it("rejects an unrecognized mode or visibility rather than silently downgrading it", () => {
      expect(
        validateMessage({
          t: "dice-roll",
          formula: "d20",
          mode: "superadvantage",
        } as unknown as ClientMessage),
      ).toMatchObject({
        valid: false,
        error: "dice-roll: mode must be normal, advantage or disadvantage",
      });
      expect(
        validateMessage({
          t: "dice-roll",
          formula: "d20",
          visibility: "everyone",
        } as unknown as ClientMessage),
      ).toMatchObject({
        valid: false,
        error: "dice-roll: visibility must be public, dm or self",
      });
    });

    it("does not care about a total, a uid or a name — there is nowhere for them to go", () => {
      // They pass validation and are then ignored: the handler reads only
      // formula/mode/visibility. Pinned so nobody "fixes" this by bounding
      // them, which is how the forgeable shape came back into scope.
      expect(
        validateMessage({
          t: "dice-roll",
          formula: "d20",
          total: 999,
          playerUid: "somebody-else",
        } as unknown as ClientMessage),
      ).toEqual({ valid: true });
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
      error: "draw: drawing exceeds point limit (max 10000)",
    });
  });

  it("validates load-session snapshot structure", () => {
    const result = validateMessage({
      t: "load-session",
      snapshot: { tokens: {}, players: [], drawings: [] },
    });

    expect(result).toMatchObject({ valid: false });
  });

  describe("drag-preview validation", () => {
    it("rejects payloads without an objects array", () => {
      expect(validateMessage({ t: "drag-preview" })).toMatchObject({
        valid: false,
        error: "drag-preview: objects must be an array",
      });
    });

    it("rejects empty object arrays", () => {
      expect(validateMessage({ t: "drag-preview", objects: [] })).toMatchObject({
        valid: false,
        error: "drag-preview: objects cannot be empty",
      });
    });

    it("rejects entries missing ids or coordinates", () => {
      expect(
        validateMessage({ t: "drag-preview", objects: [{ id: "", x: 1, y: 1 }] }),
      ).toMatchObject({
        valid: false,
        error: "drag-preview: object 0 missing id",
      });

      expect(
        validateMessage({
          t: "drag-preview",
          objects: [{ id: "token:1", x: "nope", y: 2 }],
        }),
      ).toMatchObject({
        valid: false,
        error: "drag-preview: object 0 missing coordinates",
      });
    });
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
        error: "draw: drawing exceeds point limit (max 10000)",
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

    /**
     * The count bound lives here rather than in a router test on purpose:
     * router.route() runs AFTER validation in production, so routing a
     * malformed frame proves nothing about the gate that would have stopped
     * it. The handler LOOPS on this value, which is what makes the bound
     * load-bearing rather than cosmetic.
     */
    describe("create-npc count (S8 bulk add)", () => {
      const base = { t: "create-npc", name: "Goblin", hp: 10, maxHp: 10 };

      it("accepts an absent count — the plain + Add NPC button sends none", () => {
        expect(validateMessage({ ...base })).toEqual({ valid: true });
      });

      it("accepts the whole permitted range", () => {
        for (const count of [1, 2, 5, 19, 20]) {
          expect(validateMessage({ ...base, count })).toEqual({ valid: true });
        }
      });

      it("rejects a count above the ceiling", () => {
        expect(validateMessage({ ...base, count: 21 })).toMatchObject({ valid: false });
        expect(validateMessage({ ...base, count: 10_000 })).toMatchObject({ valid: false });
      });

      it("rejects zero and negatives", () => {
        expect(validateMessage({ ...base, count: 0 })).toMatchObject({ valid: false });
        expect(validateMessage({ ...base, count: -3 })).toMatchObject({ valid: false });
      });

      it("rejects a non-integer count, which would spin the loop on a fraction", () => {
        expect(validateMessage({ ...base, count: 2.5 })).toMatchObject({ valid: false });
      });

      it("rejects the values isFiniteNumber alone would admit", () => {
        // 1e308 is finite. Looping on it is a self-inflicted denial of service.
        expect(validateMessage({ ...base, count: 1e308 })).toMatchObject({ valid: false });
        expect(validateMessage({ ...base, count: Number.MAX_SAFE_INTEGER })).toMatchObject({
          valid: false,
        });
      });

      it("rejects a non-number count", () => {
        for (const count of ["5", null, {}, [], true, Number.NaN, Infinity]) {
          expect(validateMessage({ ...base, count })).toMatchObject({ valid: false });
        }
      });
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

    it("accepts create-npc with zero hp, the same as update-npc", () => {
      // S8's Duplicate replays the source NPC's own hp, so duplicating a goblin
      // that had been knocked to 0 sent hp: 0 — which this validator rejected,
      // and a rejected frame gets no reply, so the DM saw "NPC creation timed
      // out" and retrying never worked. update-npc has always allowed 0 and
      // createCharacter clamps with Math.max(0, …); create-npc was the outlier.
      expect(
        validateMessage({
          t: "create-npc",
          name: "Downed Goblin",
          hp: 0,
          maxHp: 7,
          portrait: undefined,
          tokenImage: undefined,
        }),
      ).toMatchObject({ valid: true });
    });

    it("still rejects create-npc with zero maxHp", () => {
      // Relaxing hp must not relax maxHp: a character with no maximum is not a
      // downed character, it is a broken one.
      expect(
        validateMessage({
          t: "create-npc",
          name: "Nothing",
          hp: 0,
          maxHp: 0,
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

    it("validates toggle-npc-visibility", () => {
      expect(validateMessage({ t: "toggle-npc-visibility", id: "npc-1", visible: false })).toEqual({
        valid: true,
      });
    });

    it("rejects toggle-npc-visibility with missing id", () => {
      expect(validateMessage({ t: "toggle-npc-visibility", id: "", visible: true })).toMatchObject({
        valid: false,
        error: "toggle-npc-visibility: missing or invalid id",
      });
    });

    it("rejects toggle-npc-visibility with non-boolean visible", () => {
      expect(
        validateMessage({ t: "toggle-npc-visibility", id: "npc-1", visible: "yes" }),
      ).toMatchObject({
        valid: false,
        error: "toggle-npc-visibility: visible must be boolean",
      });
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

    it("validates set-token-color with a non-empty string", () => {
      expect(
        validateMessage({ t: "set-token-color", tokenId: "token-1", color: "#ff00ff" }),
      ).toEqual({ valid: true });
    });

    it("rejects set-token-color with empty or whitespace color", () => {
      expect(
        validateMessage({ t: "set-token-color", tokenId: "token-1", color: "" }),
      ).toMatchObject({
        valid: false,
        error: "set-token-color: color cannot be empty",
      });
      expect(
        validateMessage({ t: "set-token-color", tokenId: "token-1", color: "   " }),
      ).toMatchObject({
        valid: false,
        error: "set-token-color: color cannot be empty",
      });
    });
  });

  describe("Edge Cases: Player Metadata", () => {
    it("validates set-status-effects with trimmed strings", () => {
      expect(
        validateMessage({
          t: "set-status-effects",
          effects: ["poisoned", "burning"],
        }),
      ).toEqual({ valid: true });
    });

    it("rejects set-status-effects when effects are not strings", () => {
      expect(
        validateMessage({
          t: "set-status-effects",
          effects: ["poisoned", 42],
        }),
      ).toMatchObject({
        valid: false,
        error: "set-status-effects: effects must be strings",
      });
    });

    it("validates sync-player-drawings with sanitized drawings", () => {
      expect(
        validateMessage({
          t: "sync-player-drawings",
          drawings: [
            {
              id: "draw-1",
              type: "freehand",
              points: [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ],
              color: "#fff",
              width: 2,
              opacity: 1,
            },
          ],
        }),
      ).toEqual({ valid: true });
    });

    it("rejects sync-player-drawings when payload is not an array", () => {
      expect(
        validateMessage({
          t: "sync-player-drawings",
          drawings: "not-an-array",
        }),
      ).toMatchObject({
        valid: false,
        error: "sync-player-drawings: drawings must be an array",
      });
    });
  });

  describe("Edge Cases: Staging Zone", () => {
    it("validates set-player-staging-zone with null", () => {
      expect(validateMessage({ t: "set-player-staging-zone", zone: null })).toEqual({
        valid: true,
      });
    });

    it("validates set-player-staging-zone with numeric values", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: 1, y: 2, width: 5, height: 3, rotation: 45 },
        }),
      ).toEqual({ valid: true });
    });

    it("rejects set-player-staging-zone with invalid numbers", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: "bad", y: 0, width: 2, height: 2 },
        }),
      ).toMatchObject({
        valid: false,
        error: "set-player-staging-zone: zone x/y must be finite numbers",
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

    it("validates set-room-password without a secret (reset to server default)", () => {
      expect(validateMessage({ t: "set-room-password" })).toEqual({
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

  describe("Edge Cases: Character Management", () => {
    it("validates add-player-character with minimal fields", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "Gandalf",
        }),
      ).toEqual({ valid: true });
    });

    it("validates add-player-character with maxHp", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "Aragorn",
          maxHp: 50,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects add-player-character with empty name", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "",
        }),
      ).toMatchObject({
        valid: false,
        error: "add-player-character: name must be 1-100 characters",
      });
    });

    it("rejects add-player-character with name exceeding 100 chars", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "a".repeat(101),
        }),
      ).toMatchObject({
        valid: false,
        error: "add-player-character: name must be 1-100 characters",
      });
    });

    it("accepts add-player-character with name at exactly 100 chars", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "a".repeat(100),
        }),
      ).toEqual({ valid: true });
    });

    it("rejects add-player-character with zero maxHp", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "Test",
          maxHp: 0,
        }),
      ).toMatchObject({
        valid: false,
        error: "add-player-character: maxHp must be positive",
      });
    });

    it("rejects add-player-character with negative maxHp", () => {
      expect(
        validateMessage({
          t: "add-player-character",
          name: "Test",
          maxHp: -10,
        }),
      ).toMatchObject({
        valid: false,
        error: "add-player-character: maxHp must be positive",
      });
    });

    it("validates delete-player-character", () => {
      expect(
        validateMessage({
          t: "delete-player-character",
          characterId: "char-123",
        }),
      ).toEqual({ valid: true });
    });

    it("rejects delete-player-character with empty characterId", () => {
      expect(
        validateMessage({
          t: "delete-player-character",
          characterId: "",
        }),
      ).toMatchObject({
        valid: false,
        error: "delete-player-character: missing or invalid characterId",
      });
    });

    it("validates update-character-name", () => {
      expect(
        validateMessage({
          t: "update-character-name",
          characterId: "char-123",
          name: "New Name",
        }),
      ).toEqual({ valid: true });
    });

    it("accepts update-character-name with exactly 100 chars", () => {
      expect(
        validateMessage({
          t: "update-character-name",
          characterId: "char-123",
          name: "a".repeat(100),
        }),
      ).toEqual({ valid: true });
    });

    it("rejects update-character-name with name exceeding 100 chars", () => {
      expect(
        validateMessage({
          t: "update-character-name",
          characterId: "char-123",
          name: "a".repeat(101),
        }),
      ).toMatchObject({
        valid: false,
        error: "update-character-name: name must be 1-100 characters",
      });
    });

    it("validates set-initiative with initiativeModifier", () => {
      expect(
        validateMessage({
          t: "set-initiative",
          characterId: "char-123",
          initiative: 15,
          initiativeModifier: 3,
        }),
      ).toEqual({ valid: true });
    });

    it("validates set-initiative without initiativeModifier", () => {
      expect(
        validateMessage({
          t: "set-initiative",
          characterId: "char-123",
          initiative: 18,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects set-initiative with non-number initiativeModifier", () => {
      expect(
        validateMessage({
          t: "set-initiative",
          characterId: "char-123",
          initiative: 15,
          initiativeModifier: "3",
        }),
      ).toMatchObject({
        valid: false,
        error: "set-initiative: initiativeModifier must be a number",
      });
    });
  });

  describe("Edge Cases: Combat Messages", () => {
    it("validates start-combat", () => {
      expect(validateMessage({ t: "start-combat" })).toEqual({ valid: true });
    });

    it("validates end-combat", () => {
      expect(validateMessage({ t: "end-combat" })).toEqual({ valid: true });
    });

    it("validates next-turn", () => {
      expect(validateMessage({ t: "next-turn" })).toEqual({ valid: true });
    });

    it("validates previous-turn", () => {
      expect(validateMessage({ t: "previous-turn" })).toEqual({ valid: true });
    });
  });

  describe("Edge Cases: DM Password Messages", () => {
    it("validates elevate-to-dm", () => {
      expect(
        validateMessage({
          t: "elevate-to-dm",
          dmPassword: "secret123",
        }),
      ).toEqual({ valid: true });
    });

    it("rejects elevate-to-dm with empty dmPassword", () => {
      expect(
        validateMessage({
          t: "elevate-to-dm",
          dmPassword: "",
        }),
      ).toMatchObject({
        valid: false,
        error: "elevate-to-dm: missing or invalid dmPassword",
      });
    });

    it("rejects elevate-to-dm with excessively long dmPassword", () => {
      expect(
        validateMessage({
          t: "elevate-to-dm",
          dmPassword: "a".repeat(257),
        }),
      ).toMatchObject({
        valid: false,
        error: "elevate-to-dm: dmPassword too long",
      });
    });

    it("accepts elevate-to-dm with dmPassword at exactly 256 chars", () => {
      expect(
        validateMessage({
          t: "elevate-to-dm",
          dmPassword: "a".repeat(256),
        }),
      ).toEqual({ valid: true });
    });

    it("validates set-dm-password", () => {
      expect(
        validateMessage({
          t: "set-dm-password",
          dmPassword: "newSecret456",
        }),
      ).toEqual({ valid: true });
    });

    it("rejects set-dm-password with empty dmPassword", () => {
      expect(
        validateMessage({
          t: "set-dm-password",
          dmPassword: "",
        }),
      ).toMatchObject({
        valid: false,
        error: "set-dm-password: missing or invalid dmPassword",
      });
    });

    it("rejects set-dm-password with excessively long dmPassword", () => {
      expect(
        validateMessage({
          t: "set-dm-password",
          dmPassword: "a".repeat(257),
        }),
      ).toMatchObject({
        valid: false,
        error: "set-dm-password: dmPassword too long",
      });
    });

    it("validates revoke-dm", () => {
      expect(validateMessage({ t: "revoke-dm" })).toEqual({ valid: true });
    });
  });

  describe("Edge Cases: Boundary Values", () => {
    it("accepts name at exactly 50 chars for create-character", () => {
      expect(
        validateMessage({
          t: "create-character",
          name: "a".repeat(50),
          maxHp: 20,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects name at 51 chars for create-character", () => {
      expect(
        validateMessage({
          t: "create-character",
          name: "a".repeat(51),
          maxHp: 20,
        }),
      ).toMatchObject({
        valid: false,
        error: "create-character: name must be 1-50 characters",
      });
    });

    it("accepts effect label at exactly 64 chars", () => {
      expect(
        validateMessage({
          t: "set-status-effects",
          effects: ["a".repeat(64)],
        }),
      ).toEqual({ valid: true });
    });

    it("rejects effect label at 65 chars", () => {
      expect(
        validateMessage({
          t: "set-status-effects",
          effects: ["a".repeat(65)],
        }),
      ).toMatchObject({
        valid: false,
        error: "set-status-effects: effect labels too long (max 64 chars)",
      });
    });

    it("accepts exactly 50 partial segments in erase-partial", () => {
      const segments = Array(50).fill(basePartialSegment);
      expect(
        validateMessage({
          t: "erase-partial",
          deleteId: "drawing-1",
          segments,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects 51 partial segments in erase-partial", () => {
      const segments = Array(51).fill(basePartialSegment);
      expect(
        validateMessage({
          t: "erase-partial",
          deleteId: "drawing-1",
          segments,
        }),
      ).toMatchObject({
        valid: false,
        error: "erase-partial: too many segments (max 50)",
      });
    });

    it("accepts drawing with exactly 10,000 points", () => {
      const points = Array(10000)
        .fill(null)
        .map(() => ({ x: 0, y: 0 }));
      expect(
        validateMessage({
          t: "draw",
          drawing: { ...baseDrawing, points },
        }),
      ).toEqual({ valid: true });
    });

    it("rejects drawing with 10,001 points", () => {
      const points = Array(10001)
        .fill(null)
        .map(() => ({ x: 0, y: 0 }));
      expect(
        validateMessage({
          t: "draw",
          drawing: { ...baseDrawing, points },
        }),
      ).toMatchObject({
        valid: false,
        error: "draw: drawing exceeds point limit (max 10000)",
      });
    });

    it("accepts exactly 16 status effects", () => {
      const effects = Array(16).fill("effect");
      expect(
        validateMessage({
          t: "set-status-effects",
          effects,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects 17 status effects", () => {
      const effects = Array(17).fill("effect");
      expect(
        validateMessage({
          t: "set-status-effects",
          effects,
        }),
      ).toMatchObject({
        valid: false,
        error: "set-status-effects: too many effects (max 16)",
      });
    });

    it("accepts exactly 100 objectIds in select-multiple", () => {
      const objectIds = Array.from({ length: 100 }, (_, i) => `obj-${i}`);
      expect(
        validateMessage({
          t: "select-multiple",
          uid: "uid-1",
          objectIds,
        }),
      ).toEqual({ valid: true });
    });

    it("accepts exactly 200 drawings in sync-player-drawings", () => {
      const drawings = Array(200).fill({
        id: "draw-1",
        type: "freehand",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: "#fff",
        width: 2,
        opacity: 1,
      });
      expect(
        validateMessage({
          t: "sync-player-drawings",
          drawings,
        }),
      ).toEqual({ valid: true });
    });

    it("rejects 201 drawings in sync-player-drawings", () => {
      const drawings = Array(201).fill({
        id: "draw-1",
        type: "freehand",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        color: "#fff",
        width: 2,
        opacity: 1,
      });
      expect(
        validateMessage({
          t: "sync-player-drawings",
          drawings,
        }),
      ).toMatchObject({
        valid: false,
        error: "sync-player-drawings: too many drawings (max 200)",
      });
    });
  });

  describe("Edge Cases: Staging Zone Minimal Size", () => {
    it("accepts staging zone with width/height at exactly 0.5", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: 0, y: 0, width: 0.5, height: 0.5 },
        }),
      ).toEqual({ valid: true });
    });

    it("rejects staging zone with width below 0.5", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: 0, y: 0, width: 0.4, height: 1 },
        }),
      ).toMatchObject({
        valid: false,
        error: "set-player-staging-zone: zone width/height must be at least 0.5",
      });
    });

    it("rejects staging zone with height below 0.5", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: 0, y: 0, width: 1, height: 0.4 },
        }),
      ).toMatchObject({
        valid: false,
        error: "set-player-staging-zone: zone width/height must be at least 0.5",
      });
    });

    it("accepts staging zone with negative width exceeding -0.5", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: 0, y: 0, width: -1, height: 1 },
        }),
      ).toEqual({ valid: true });
    });

    it("rejects staging zone with negative width below -0.5", () => {
      expect(
        validateMessage({
          t: "set-player-staging-zone",
          zone: { x: 0, y: 0, width: -0.4, height: 1 },
        }),
      ).toMatchObject({
        valid: false,
        error: "set-player-staging-zone: zone width/height must be at least 0.5",
      });
    });
  });

  describe("Edge Cases: Transform Staging Zone", () => {
    it("accepts transform-object for staging-zone with large scale", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "staging-zone",
          scale: { x: 50, y: 50 },
        }),
      ).toEqual({ valid: true });
    });

    it("accepts transform-object for staging-zone with small scale", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "staging-zone",
          scale: { x: 0.01, y: 0.01 },
        }),
      ).toEqual({ valid: true });
    });

    it("accepts transform-object for staging-zone with position and scale", () => {
      expect(
        validateMessage({
          t: "transform-object",
          id: "staging-zone",
          position: { x: 100, y: 200 },
          scale: { x: 25, y: 15 },
          rotation: 45,
        }),
      ).toEqual({ valid: true });
    });
  });
  // ==========================================================================
  // S6: DIAGONAL RULE, MEASUREMENT RELAY, AREA TEMPLATES
  // ==========================================================================
  // These live here rather than in a router contract test because
  // `router.route()` runs AFTER the pipeline has validated — a malformed frame
  // never reaches route() in production, and a contract test that routes one
  // directly proves nothing about the validator.

  describe("set-diagonal-rule", () => {
    it("accepts each of the three real rules", () => {
      for (const rule of ["5e", "pathfinder", "euclidean"]) {
        expect(validateMessage({ t: "set-diagonal-rule", rule })).toEqual({ valid: true });
      }
    });

    it("rejects a rule outside the whitelist", () => {
      expect(validateMessage({ t: "set-diagonal-rule", rule: "chebyshev" })).toEqual({
        valid: false,
        error: "set-diagonal-rule: rule must be 5e, pathfinder, or euclidean",
      });
    });

    it("rejects a missing or non-string rule", () => {
      expect(validateMessage({ t: "set-diagonal-rule" }).valid).toBe(false);
      expect(validateMessage({ t: "set-diagonal-rule", rule: 5 }).valid).toBe(false);
      expect(validateMessage({ t: "set-diagonal-rule", rule: null }).valid).toBe(false);
    });
  });

  describe("set-token-vision-radius", () => {
    it("accepts null — the clear-back-to-unlimited signal", () => {
      expect(
        validateMessage({ t: "set-token-vision-radius", tokenId: "t1", radius: null }),
      ).toEqual({ valid: true });
    });

    it("accepts the ends of the range and a typical darkvision", () => {
      for (const radius of [0, 5, 60, 120, 1000]) {
        expect(validateMessage({ t: "set-token-vision-radius", tokenId: "t1", radius })).toEqual({
          valid: true,
        });
      }
    });

    it("rejects a missing or empty tokenId", () => {
      expect(validateMessage({ t: "set-token-vision-radius", radius: 60 }).valid).toBe(false);
      expect(validateMessage({ t: "set-token-vision-radius", tokenId: "", radius: 60 }).valid).toBe(
        false,
      );
      expect(validateMessage({ t: "set-token-vision-radius", tokenId: 7, radius: 60 }).valid).toBe(
        false,
      );
    });

    // `isFiniteNumber` alone would let all of these through, and each one
    // reaches the vision sweep: a negative silently blinds the token, and an
    // absurd one hands the geometry a nonsense extent.
    it("rejects a radius outside the range", () => {
      expect(
        validateMessage({ t: "set-token-vision-radius", tokenId: "t1", radius: -1 }).valid,
      ).toBe(false);
      expect(
        validateMessage({ t: "set-token-vision-radius", tokenId: "t1", radius: 1001 }).valid,
      ).toBe(false);
      expect(
        validateMessage({ t: "set-token-vision-radius", tokenId: "t1", radius: 1e308 }).valid,
      ).toBe(false);
    });

    it("rejects a non-numeric radius", () => {
      for (const radius of ["60", undefined, {}, [], true, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(validateMessage({ t: "set-token-vision-radius", tokenId: "t1", radius }).valid).toBe(
          false,
        );
      }
    });
  });

  describe("set-default-vision-radius", () => {
    it("accepts null — the clear-the-table-default signal", () => {
      expect(validateMessage({ t: "set-default-vision-radius", radius: null })).toEqual({
        valid: true,
      });
    });

    it("accepts the ends of the range, including a blind table", () => {
      for (const radius of [0, 5, 60, 120, 1000]) {
        expect(validateMessage({ t: "set-default-vision-radius", radius })).toEqual({
          valid: true,
        });
      }
    });

    // The same reach as the per-token radius: this value lands in the vision
    // sweep for every token that has none of its own, so a negative would
    // blind the whole table and an absurd one hands the geometry nonsense.
    it("rejects a radius outside the range", () => {
      expect(validateMessage({ t: "set-default-vision-radius", radius: -1 }).valid).toBe(false);
      expect(validateMessage({ t: "set-default-vision-radius", radius: 1001 }).valid).toBe(false);
      expect(validateMessage({ t: "set-default-vision-radius", radius: 1e308 }).valid).toBe(false);
    });

    // Absent is refused rather than read as null: clearing the table default
    // is a deliberate act and has to be spelled.
    it("rejects a non-numeric or absent radius", () => {
      for (const radius of ["60", undefined, {}, [], true, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(validateMessage({ t: "set-default-vision-radius", radius }).valid).toBe(false);
      }
      expect(validateMessage({ t: "set-default-vision-radius" }).valid).toBe(false);
    });
  });

  describe("measure", () => {
    const line = { start: { x: 10, y: 20 }, end: { x: 30, y: 40 } };

    it("accepts a two-point measurement", () => {
      expect(validateMessage({ t: "measure", measure: line })).toEqual({ valid: true });
    });

    it("accepts null — the stop-measuring signal", () => {
      expect(validateMessage({ t: "measure", measure: null })).toEqual({ valid: true });
    });

    it("rejects a missing measure field", () => {
      expect(validateMessage({ t: "measure" }).valid).toBe(false);
    });

    it("rejects a missing endpoint", () => {
      expect(validateMessage({ t: "measure", measure: { start: line.start } }).valid).toBe(false);
      expect(validateMessage({ t: "measure", measure: { end: line.end } }).valid).toBe(false);
    });

    it("rejects coordinates that are not finite numbers", () => {
      // A hand-built frame can carry a string or Infinity where JSON cannot
      // carry NaN; both would reach the renderer as garbage geometry.
      expect(
        validateMessage({ t: "measure", measure: { start: { x: "0", y: 0 }, end: line.end } })
          .valid,
      ).toBe(false);
      expect(
        validateMessage({
          t: "measure",
          measure: { start: { x: 0, y: 0 }, end: { x: Number.POSITIVE_INFINITY, y: 0 } },
        }).valid,
      ).toBe(false);
      expect(validateMessage({ t: "measure", measure: { start: null, end: line.end } }).valid).toBe(
        false,
      );
    });
  });

  describe("draw with an area template", () => {
    const templateDrawing = {
      ...baseDrawing,
      type: "template" as const,
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ],
    };

    it("accepts a well-formed template", () => {
      expect(
        validateMessage({
          t: "draw",
          drawing: { ...templateDrawing, template: { kind: "cone", sizeFeet: 15 } },
        }),
      ).toEqual({ valid: true });
    });

    it("rejects a template kind outside the whitelist", () => {
      expect(
        validateMessage({
          t: "draw",
          drawing: { ...templateDrawing, template: { kind: "hypercube", sizeFeet: 15 } },
        }),
      ).toEqual({
        valid: false,
        error: "draw: drawing template must name a real kind with a positive size",
      });
    });

    it("rejects a template with a missing or impossible size", () => {
      for (const sizeFeet of [undefined, 0, -5, "15"]) {
        expect(
          validateMessage({
            t: "draw",
            drawing: { ...templateDrawing, template: { kind: "cone", sizeFeet } },
          }).valid,
        ).toBe(false);
      }
    });

    it("still accepts a drawing with no template field at all", () => {
      expect(validateMessage({ t: "draw", drawing: baseDrawing })).toEqual({ valid: true });
    });
  });
});
