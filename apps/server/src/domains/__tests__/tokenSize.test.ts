import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenService } from "../token/service.js";
import { createEmptyRoomState } from "../room/model.js";
import type { RoomState } from "../room/model.js";

/**
 * Phase 11A: Token Size System Tests (TDD)
 * These tests define the expected behavior for token size variants.
 * Tests are written FIRST, then implementation follows.
 */
describe("TokenService - Size System", () => {
  const service = new TokenService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Token Creation with Size", () => {
    it("creates tokens with default medium size", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);

      expect(token.size).toBe("medium");
    });

    it("creates tokens with specified size", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0, undefined, "large");

      expect(token.size).toBe("large");
    });

    it("creates tokens with all valid size variants", () => {
      const state = createEmptyRoomState();
      const sizes = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

      for (const size of sizes) {
        const token = service.createToken(state, `owner-${size}`, 0, 0, undefined, size);
        expect(token.size).toBe(size);
      }

      expect(state.tokens).toHaveLength(6);
    });
  });

  describe("setTokenSize Method", () => {
    it("updates token size when owner requests it", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);

      const result = service.setTokenSize(state, token.id, "owner-1", "huge");

      expect(result).toBe(true);
      expect(state.tokens[0]?.size).toBe("huge");
    });

    it("rejects size change from non-owner", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);

      const result = service.setTokenSize(state, token.id, "other-player", "large");

      expect(result).toBe(false);
      expect(state.tokens[0]?.size).toBe("medium"); // Should remain unchanged
    });

    it("accepts all valid size strings", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);
      const sizes = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

      for (const size of sizes) {
        const result = service.setTokenSize(state, token.id, "owner-1", size);
        expect(result).toBe(true);
        expect(state.tokens[0]?.size).toBe(size);
      }
    });

    it("returns false for non-existent token ID", () => {
      const state = createEmptyRoomState();

      const result = service.setTokenSize(state, "non-existent", "owner-1", "large");

      expect(result).toBe(false);
    });

    it("respects locked state (cannot resize locked tokens)", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);

      // Lock the token (this will be implemented via scene object transform)
      // For now, we'll add a locked property to the token for testing
      state.tokens[0]!.locked = true;

      const result = service.setTokenSize(state, token.id, "owner-1", "large");

      expect(result).toBe(false);
      expect(state.tokens[0]?.size).toBe("medium"); // Should remain unchanged
    });
  });

  describe("DM Override for Locked Tokens", () => {
    it("allows DM to resize locked tokens", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);
      state.tokens[0]!.locked = true;

      // DM should be able to override locked state
      const result = service.setTokenSizeByDM(state, token.id, "huge");

      expect(result).toBe(true);
      expect(state.tokens[0]?.size).toBe("huge");
    });

    it("DM can resize any token regardless of ownership", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);

      const result = service.setTokenSizeByDM(state, token.id, "gargantuan");

      expect(result).toBe(true);
      expect(state.tokens[0]?.size).toBe("gargantuan");
    });

    it("DM resize returns false for non-existent token", () => {
      const state = createEmptyRoomState();

      const result = service.setTokenSizeByDM(state, "non-existent", "large");

      expect(result).toBe(false);
    });
  });

  describe("Size Persistence", () => {
    it("persists token size in state", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 5, 10, undefined, "huge");

      expect(state.tokens[0]).toMatchObject({
        id: token.id,
        owner: "owner-1",
        x: 5,
        y: 10,
        size: "huge",
      });
    });

    it("maintains size after other token operations", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0, undefined, "large");

      service.moveToken(state, token.id, "owner-1", 10, 20);
      expect(state.tokens[0]?.size).toBe("large");

      service.recolorToken(state, token.id, "owner-1");
      expect(state.tokens[0]?.size).toBe("large");

      service.setImageUrl(state, token.id, "owner-1", "https://example.com/img.png");
      expect(state.tokens[0]?.size).toBe("large");
    });
  });

  describe("findToken Method", () => {
    it("finds token and includes size property", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0, undefined, "tiny");

      const found = service.findToken(state, token.id);

      expect(found).toBeDefined();
      expect(found?.size).toBe("tiny");
    });
  });
});
