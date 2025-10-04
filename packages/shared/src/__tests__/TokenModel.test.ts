import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenModel } from "../models.js";

describe("TokenModel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseToken = new TokenModel("id-1", "player-1", 10, 20, "hsl(0, 70%, 50%)");

  it("creates from JSON and preserves fields", () => {
    const json = baseToken.toJSON();
    const fromJson = TokenModel.fromJSON(json);

    expect(fromJson).toBeInstanceOf(TokenModel);
    expect(fromJson).not.toBe(baseToken);
    expect(fromJson).toEqual(baseToken);
  });

  it("moves to new coordinates immutably", () => {
    const moved = baseToken.moveTo(42, 87);

    expect(moved).toEqual({ ...baseToken, x: 42, y: 87 });
    expect(moved).not.toBe(baseToken);
    expect(baseToken.x).toBe(10);
    expect(baseToken.y).toBe(20);
  });

  it("recolors immutably", () => {
    const recolored = baseToken.recolor("hsl(120, 70%, 50%)");

    expect(recolored.color).toBe("hsl(120, 70%, 50%)");
    expect(recolored.id).toBe(baseToken.id);
    expect(recolored).not.toBe(baseToken);
  });

  it("snaps to the closest grid coordinate", () => {
    const token = new TokenModel("id", "owner", 47, 78, "red");
    const snapped = token.snapToGrid(25);

    expect(snapped.x).toBe(50);
    expect(snapped.y).toBe(75);
  });

  it("computes distance to another token", () => {
    const other = new TokenModel("id-2", "player-2", 13, 24, "blue");

    expect(baseToken.distanceTo(other)).toBeCloseTo(5);
  });

  it("validates ownership", () => {
    expect(baseToken.isOwnedBy("player-1")).toBe(true);
    expect(baseToken.isOwnedBy("player-2")).toBe(false);
  });

  it("generates random HSL colors", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);

    const color = TokenModel.randomColor();

    expect(color).toBe("hsl(90, 70%, 50%)");
  });
});
