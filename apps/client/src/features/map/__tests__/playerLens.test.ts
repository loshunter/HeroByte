// Player-lens contract (P4): the lens mirrors the server's per-recipient
// strips for DISPLAY — it must hide exactly what a player snapshot omits
// (secret doors), fog exactly what players fog, and never touch what is
// already uniformly filtered (mapElements — the sole-producer invariant).

import { describe, expect, it } from "vitest";
import type { CompiledDoor, Token } from "@herobyte/shared";
import { dmViewActive, fogViewers, fogViewerTokens, visibleDoors } from "../playerLens";

const door = (id: string, state: CompiledDoor["state"]): CompiledDoor =>
  ({ id, state, x1: 0, y1: 0, x2: 50, y2: 0 }) as CompiledDoor;

const token = (id: string, owner: string): Token => ({ id, owner, x: 1, y: 2 }) as Token;

describe("dmViewActive", () => {
  it("is on for a DM without the lens, off with it, and never on for players", () => {
    expect(dmViewActive(true, false)).toBe(true);
    expect(dmViewActive(true, true)).toBe(false);
    expect(dmViewActive(false, false)).toBe(false);
    expect(dmViewActive(false, true)).toBe(false);
  });
});

describe("visibleDoors", () => {
  const doors = [door("a", "open"), door("b", "secret"), door("c", "locked")];

  it("strips secret doors outside the DM view — the server's player rule", () => {
    expect(visibleDoors(doors, false).map((d) => d.id)).toEqual(["a", "c"]);
  });

  it("keeps every door for the DM view", () => {
    expect(visibleDoors(doors, true).map((d) => d.id)).toEqual(["a", "b", "c"]);
  });
});

describe("fogViewerTokens", () => {
  const tokens = [token("mine", "dm-uid"), token("p1", "player-1"), token("p2", "player-2")];

  it("uses the viewer's OWN tokens normally (the player fog rule)", () => {
    expect(fogViewerTokens(tokens, "player-1", false).map((t) => t.id)).toEqual(["p1"]);
  });

  it("uses the PARTY's union vision under the lens (every token the DM does not own)", () => {
    expect(fogViewerTokens(tokens, "dm-uid", true).map((t) => t.id)).toEqual(["p1", "p2"]);
  });
});

// The step MapBoard used to do inline, where it discarded the Token and kept
// only {x,y} — which is exactly how a per-token sight radius would have been
// lost between the snapshot and the fog.
describe("fogViewers", () => {
  const tokens: Token[] = [
    { id: "mine", owner: "dm-uid", x: 1, y: 2, color: "red" },
    { id: "p1", owner: "player-1", x: 3, y: 4, color: "blue", visionRadius: 60 },
    { id: "p2", owner: "player-2", x: 5, y: 6, color: "green" },
  ];

  it("converts cells to world-pixel CELL CENTRES, matching the renderer", () => {
    // Cell (3,4) at gridSize 50 is world (3*50+25, 4*50+25).
    expect(fogViewers(tokens, "player-1", false, 50, undefined)).toEqual([
      { x: 175, y: 225, radiusFeet: 60 },
    ]);
  });

  it("carries each token's own sight radius through", () => {
    const viewers = fogViewers(tokens, "dm-uid", true, 50, undefined);
    expect(viewers.map((viewer) => viewer.radiusFeet)).toEqual([60, undefined]);
  });

  it("leaves an unset radius undefined rather than inventing a default", () => {
    expect(fogViewers(tokens, "player-2", false, 50, undefined)[0]!.radiusFeet).toBeUndefined();
  });

  it("uses the party union under the lens, exactly as fogViewerTokens does", () => {
    expect(fogViewers(tokens, "dm-uid", true, 50, undefined)).toHaveLength(2);
    expect(fogViewers(tokens, "dm-uid", false, 50, undefined)).toHaveLength(1);
  });

  it("falls back to the table default for a token carrying no radius", () => {
    expect(fogViewers(tokens, "player-2", false, 50, 30)[0]!.radiusFeet).toBe(30);
  });

  it("lets a token's own radius beat the table default", () => {
    expect(fogViewers(tokens, "player-1", false, 50, 30)[0]!.radiusFeet).toBe(60);
  });

  // The ??-not-|| case on the client side. The two halves resolve this the
  // same way or the fog and the payload disagree about what is visible.
  it("lets an explicit 0 beat a generous default", () => {
    const blind: Token[] = [
      { id: "blind", owner: "player-3", x: 0, y: 0, color: "red", visionRadius: 0 },
    ];
    expect(fogViewers(blind, "player-3", false, 50, 120)[0]!.radiusFeet).toBe(0);
  });

  // A DM who darkened the table must SEE that darkness through the lens —
  // otherwise the one toggle built to show what players see lies about it.
  it("applies the default across the party union under the lens", () => {
    expect(fogViewers(tokens, "dm-uid", true, 50, 30).map((viewer) => viewer.radiusFeet)).toEqual([
      60, 30,
    ]);
  });
});
