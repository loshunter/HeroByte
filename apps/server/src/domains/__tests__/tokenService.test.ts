import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenService } from "../token/service.ts";
import { createEmptyRoomState } from "../room/model.ts";

describe("TokenService", () => {
  const service = new TokenService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates tokens with random color and stores them in state", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const state = createEmptyRoomState();

    const token = service.createToken(state, "owner-1", 5, 6);

    expect(token.color).toBe("hsl(90, 70%, 50%)");
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0]?.owner).toBe("owner-1");
  });

  it("moves, recolors, and deletes tokens with ownership enforcement", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = createEmptyRoomState();
    const token = service.createToken(state, "owner-1", 0, 0);

    expect(service.moveToken(state, token.id, "owner-1", 10, 20)).toBe(true);
    expect(service.moveToken(state, token.id, "other", 1, 1)).toBe(false);

    const previousColor = token.color;
    // Change mock to return different value for recolor
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(service.recolorToken(state, token.id, "owner-1")).toBe(true);
    expect(service.recolorToken(state, token.id, "other")).toBe(false);
    expect(state.tokens[0]?.color).not.toBe(previousColor);

    expect(service.deleteToken(state, token.id, "other")).toBe(false);
    expect(service.deleteToken(state, token.id, "owner-1")).toBe(true);
    expect(state.tokens).toHaveLength(0);
  });

  it("clears tokens for other players when requested", () => {
    const state = createEmptyRoomState();
    const a = service.createToken(state, "keep", 0, 0);
    const b = service.createToken(state, "drop", 1, 1);

    expect(state.tokens).toHaveLength(2);
    service.clearAllTokensExcept(state, "keep");
    expect(state.tokens).toEqual([a]);
    expect(state.tokens).not.toContain(b);
  });
});
