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

  it("updates image URL immutably", () => {
    const withImage = baseToken.setImage("https://example.com/token.png");

    expect(withImage.imageUrl).toBe("https://example.com/token.png");
    expect(baseToken.imageUrl).toBeUndefined();

    const cleared = withImage.setImage(undefined);
    expect(cleared.imageUrl).toBeUndefined();
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

  describe("Phase 11: Token Size", () => {
    it("includes size in toJSON output", () => {
      const token = new TokenModel(
        "id-1",
        "player-1",
        10,
        20,
        "hsl(0, 70%, 50%)",
        undefined,
        "large",
      );
      const json = token.toJSON();

      expect(json.size).toBe("large");
    });

    it("preserves size when creating from JSON", () => {
      const json = {
        id: "id-1",
        owner: "player-1",
        x: 10,
        y: 20,
        color: "red",
        size: "huge" as const,
      };

      const token = TokenModel.fromJSON(json);

      expect(token.size).toBe("huge");
    });

    it("defaults to medium size if not specified", () => {
      const json = {
        id: "id-1",
        owner: "player-1",
        x: 10,
        y: 20,
        color: "red",
      };

      const token = TokenModel.fromJSON(json);

      expect(token.size).toBe("medium");
    });

    it("preserves size when moving", () => {
      const token = new TokenModel("id-1", "player-1", 10, 20, "red", undefined, "tiny");
      const moved = token.moveTo(30, 40);

      expect(moved.size).toBe("tiny");
      expect(moved.x).toBe(30);
      expect(moved.y).toBe(40);
    });

    it("preserves size when recoloring", () => {
      const token = new TokenModel("id-1", "player-1", 10, 20, "red", undefined, "gargantuan");
      const recolored = token.recolor("blue");

      expect(recolored.size).toBe("gargantuan");
      expect(recolored.color).toBe("blue");
    });

    it("preserves size when setting image", () => {
      const token = new TokenModel("id-1", "player-1", 10, 20, "red", undefined, "small");
      const withImage = token.setImage("https://example.com/img.png");

      expect(withImage.size).toBe("small");
      expect(withImage.imageUrl).toBe("https://example.com/img.png");
    });
  });
});
