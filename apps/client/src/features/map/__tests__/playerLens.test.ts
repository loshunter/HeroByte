// Player-lens contract (P4): the lens mirrors the server's per-recipient
// strips for DISPLAY — it must hide exactly what a player snapshot omits
// (secret doors), fog exactly what players fog, and never touch what is
// already uniformly filtered (mapElements — the sole-producer invariant).

import { describe, expect, it } from "vitest";
import type { CompiledDoor, Token } from "@herobyte/shared";
import { dmViewActive, fogViewerTokens, visibleDoors } from "../playerLens";

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
