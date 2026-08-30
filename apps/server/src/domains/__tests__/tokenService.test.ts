import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompiledScene } from "@herobyte/shared";
import { TokenService } from "../token/service.js";
import { createEmptyRoomState } from "../room/model.js";

function compiledSceneWithWall(): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId: "map",
    sourceRevision: 1,
    compiledAt: 1,
    width: 2048,
    height: 2048,
    walls: [
      {
        id: "wall-1#0",
        x1: 50,
        y1: -100,
        x2: 50,
        y2: 100,
        blocksMovement: true,
        blocksVision: true,
      },
    ],
    doors: [],
    lights: [],
  };
}

describe("TokenService", () => {
  const service = new TokenService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates tokens with random color and stores them in state", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const state = createEmptyRoomState();

    const token = service.createToken(state, "owner-1", 5, 6, "https://example.com/token.png");

    expect(token.color).toBe("hsl(90, 70%, 50%)");
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0]?.owner).toBe("owner-1");
    expect(state.tokens[0]?.imageUrl).toBe("https://example.com/token.png");
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

  describe("movement blocking against the compiled scene", () => {
    // Tokens are in GRID CELLS (default gridSize 50): cell (0,0) is world
    // pixel (25,25). The test wall stands at pixel x=50, so moving from cell
    // 0 to cell 2 (25px -> 125px) crosses it.
    it("refuses a player move whose path crosses a blocking wall", () => {
      const state = createEmptyRoomState();
      state.compiledScene = compiledSceneWithWall();
      const token = service.createToken(state, "owner-1", 0, 0);

      expect(service.moveToken(state, token.id, "owner-1", 2, 0)).toBe(false);
      expect(state.tokens[0]).toMatchObject({ x: 0, y: 0 });
    });

    it("allows a player move that stays on one side of the wall", () => {
      const state = createEmptyRoomState();
      state.compiledScene = compiledSceneWithWall();
      const token = service.createToken(state, "owner-1", 0, 0);

      expect(service.moveToken(state, token.id, "owner-1", 0, 1)).toBe(true);
      expect(state.tokens[0]).toMatchObject({ x: 0, y: 1 });
    });

    it("lets the DM move tokens through walls", () => {
      const state = createEmptyRoomState();
      state.compiledScene = compiledSceneWithWall();
      const token = service.createToken(state, "owner-1", 0, 0);

      expect(service.moveToken(state, token.id, "dm-uid", 2, 0, true)).toBe(true);
      expect(state.tokens[0]).toMatchObject({ x: 2, y: 0 });
    });

    it("respects the live map transform when testing walls", () => {
      const state = createEmptyRoomState();
      state.compiledScene = compiledSceneWithWall();
      // Map dragged +200 in x: the wall now lives at world x=250.
      state.sceneObjects = [
        {
          id: "map",
          type: "map",
          owner: undefined,
          locked: true,
          zIndex: -100,
          transform: { x: 200, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { imageUrl: "url" },
        },
      ];
      const token = service.createToken(state, "owner-1", 0, 0);

      // Cell 2 (125px) stays left of the shifted wall; cell 6 (325px) crosses.
      expect(service.moveToken(state, token.id, "owner-1", 2, 0)).toBe(true);
      expect(service.moveToken(state, token.id, "owner-1", 6, 0)).toBe(false);
      expect(state.tokens[0]).toMatchObject({ x: 2, y: 0 });
    });

    it("moves freely when no scene has been published", () => {
      const state = createEmptyRoomState();
      const token = service.createToken(state, "owner-1", 0, 0);

      expect(service.moveToken(state, token.id, "owner-1", 10, 10)).toBe(true);
    });
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

  it("updates token image when owner requests it", () => {
    const state = createEmptyRoomState();
    const token = service.createToken(state, "keep", 0, 0);

    expect(service.setImageUrl(state, token.id, "wrong", "https://nope")).toBe(false);
    expect(service.setImageUrl(state, token.id, "keep", "https://example.com/new.png")).toBe(true);
    expect(state.tokens[0]?.imageUrl).toBe("https://example.com/new.png");

    expect(service.setImageUrl(state, token.id, "keep", "   ")).toBe(true);
    expect(state.tokens[0]?.imageUrl).toBeUndefined();
  });

  it("supports admin token image updates and deletions", () => {
    const state = createEmptyRoomState();
    const token = service.createToken(state, "owner", 0, 0);

    expect(service.setImageUrlForToken(state, token.id, "https://img")).toBe(true);
    expect(state.tokens[0]?.imageUrl).toBe("https://img");

    expect(service.forceDeleteToken(state, "missing")).toBe(false);
    expect(service.forceDeleteToken(state, token.id)).toBe(true);
    expect(state.tokens).toHaveLength(0);
  });
});

// ============================================================================
// S7 — a new token must not hand back the sight the DM took away
// ============================================================================
// A radius lives on ONE token record, but vision is the UNION over every token
// its owner has. So minting a second token used to restore unlimited sight —
// and "+ Add Character" mints one, is NOT DM-gated, and is a perfectly normal
// thing for an honest player to click. The darkness would vanish with no signal
// to the DM.
describe("vision radius inheritance on token creation", () => {
  it("gives a new token the owner's existing sight limit", () => {
    const state = createEmptyRoomState();
    state.tokens = [{ id: "first", owner: "player-1", x: 0, y: 0, color: "red", visionRadius: 30 }];

    const created = new TokenService().createToken(state, "player-1", 1, 1);

    expect(created.visionRadius).toBe(30);
  });

  it("inherits the MOST RESTRICTIVE one, failing closed", () => {
    const state = createEmptyRoomState();
    state.tokens = [
      { id: "far", owner: "player-1", x: 0, y: 0, color: "red", visionRadius: 60 },
      { id: "near", owner: "player-1", x: 1, y: 0, color: "red", visionRadius: 15 },
    ];

    expect(new TokenService().createToken(state, "player-1", 2, 2).visionRadius).toBe(15);
  });

  it("inherits a blinding zero rather than reading it as unset", () => {
    const state = createEmptyRoomState();
    state.tokens = [{ id: "blind", owner: "player-1", x: 0, y: 0, color: "red", visionRadius: 0 }];

    expect(new TokenService().createToken(state, "player-1", 1, 1).visionRadius).toBe(0);
  });

  it("stays unlimited when the owner has no limited token — nothing regresses", () => {
    const state = createEmptyRoomState();
    state.tokens = [{ id: "first", owner: "player-1", x: 0, y: 0, color: "red" }];

    const created = new TokenService().createToken(state, "player-1", 1, 1);

    expect(created.visionRadius).toBeUndefined();
    expect("visionRadius" in created).toBe(false);
  });

  it("stays unlimited for a player's FIRST token", () => {
    const state = createEmptyRoomState();

    expect(new TokenService().createToken(state, "newcomer", 0, 0).visionRadius).toBeUndefined();
  });

  it("does not inherit from someone else's token", () => {
    const state = createEmptyRoomState();
    state.tokens = [
      { id: "theirs", owner: "player-2", x: 0, y: 0, color: "blue", visionRadius: 5 },
    ];

    expect(new TokenService().createToken(state, "player-1", 1, 1).visionRadius).toBeUndefined();
  });
});

describe("TokenService recolouring", () => {
  // The defect this pins: recolorToken drew freely from 360 hues, so one press
  // in 360 redrew the hue it already had and the button visibly did nothing.
  // TokenMessageHandler.test.ts asserts "the colour CHANGED", so that 1-in-360
  // was a real flake in CI (observed 2026-08-27) — but the flake was the
  // messenger. The contract is that a recolour recolours.

  function stateWithToken(color: string) {
    const state = createEmptyRoomState();
    const service = new TokenService();
    const token = service.createToken(state, "owner-1");
    token.color = color;
    return { state, token };
  }

  it("NEVER returns the colour it started from, for any draw", () => {
    // Exhaustive over the generator's range rather than sampled: the old bug
    // lived at exactly one input value, which sampling can miss.
    const current = "hsl(200, 70%, 50%)";
    for (let i = 0; i < 359; i += 1) {
      const rng = () => (i + 0.5) / 359;
      const state = createEmptyRoomState();
      const service = new TokenService(rng);
      const token = service.createToken(state, "owner-1");
      token.color = current;

      expect(service.recolorToken(state, token.id, "owner-1")).toBe(true);
      expect(token.color, `draw ${i} reproduced the current colour`).not.toBe(current);
      expect(token.color).toMatch(/^hsl\(\d{1,3}, 70%, 50%\)$/);
    }
  });

  it("covers every OTHER hue across the draw range — it is not a fixed step", () => {
    // The cheap "always +1 hue" fix would pass the test above and make every
    // recolour predictable. This is what rules that out.
    const seen = new Set<string>();
    for (let i = 0; i < 359; i += 1) {
      const state = createEmptyRoomState();
      const service = new TokenService(() => (i + 0.5) / 359);
      const token = service.createToken(state, "owner-1");
      token.color = "hsl(0, 70%, 50%)";
      service.recolorToken(state, token.id, "owner-1");
      seen.add(token.color);
    }
    expect(seen.size).toBe(359);
    expect(seen.has("hsl(0, 70%, 50%)")).toBe(false);
  });

  it("falls back to a free draw for a colour it did not author", () => {
    const { state, token } = stateWithToken("rebeccapurple");
    const service = new TokenService(() => 0.5);
    expect(service.recolorToken(state, token.id, "owner-1")).toBe(true);
    expect(token.color).toBe("hsl(180, 70%, 50%)");
  });

  it("still refuses a recolour from someone who owns nothing", () => {
    const { state, token } = stateWithToken("hsl(10, 70%, 50%)");
    const service = new TokenService(() => 0.5);
    expect(service.recolorToken(state, token.id, "intruder")).toBe(false);
    expect(token.color).toBe("hsl(10, 70%, 50%)");
  });
});
