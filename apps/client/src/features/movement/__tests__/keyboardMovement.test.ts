// The pure rules under keyboard movement: which key names which cell delta,
// and who may move what (mirroring the server's TransformHandler so no dead
// round trip is sent). Where the cell IS is the server's business now.

import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { deltaForKey, movableSelection, ownTokenFallback } from "../keyboardMovement";

type Owned = { id: string; type: "pc" | "npc"; owner: string | null; tokenId?: string | null };
const characters = (list: Owned[]): RoomSnapshot["characters"] =>
  list.map((c) => ({
    id: c.id,
    name: c.id,
    type: c.type,
    ownedByPlayerUID: c.owner,
    tokenId: c.tokenId ?? null,
  })) as unknown as RoomSnapshot["characters"];
const tokens = (list: Array<[id: string, owner: string]>): RoomSnapshot["tokens"] =>
  list.map(([id, owner]) => ({
    id,
    owner,
    x: 0,
    y: 0,
    color: "hsl(0 0% 0%)",
  })) as unknown as RoomSnapshot["tokens"];

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    tokens: [
      { id: "mine", owner: "me", x: 3, y: 4, color: "hsl(0 0% 0%)" },
      { id: "theirs", owner: "them", x: 7, y: 8, color: "hsl(0 0% 0%)" },
    ],
    props: [
      { id: "shared", owner: "*", x: 1, y: 1 },
      { id: "dmonly", owner: null, x: 2, y: 2 },
      { id: "myprop", owner: "me", x: 5, y: 6 },
    ],
    sceneObjects: [],
    ...overrides,
  } as unknown as RoomSnapshot;
}

describe("deltaForKey", () => {
  it("maps arrows and WASD to the four orthogonals, screen-up being smaller y", () => {
    expect(deltaForKey({ key: "ArrowUp", code: "ArrowUp" })).toEqual({ dx: 0, dy: -1 });
    expect(deltaForKey({ key: "ArrowDown", code: "ArrowDown" })).toEqual({ dx: 0, dy: 1 });
    expect(deltaForKey({ key: "ArrowLeft", code: "ArrowLeft" })).toEqual({ dx: -1, dy: 0 });
    expect(deltaForKey({ key: "ArrowRight", code: "ArrowRight" })).toEqual({ dx: 1, dy: 0 });
    expect(deltaForKey({ key: "w", code: "KeyW" })).toEqual({ dx: 0, dy: -1 });
    expect(deltaForKey({ key: "s", code: "KeyS" })).toEqual({ dx: 0, dy: 1 });
    expect(deltaForKey({ key: "a", code: "KeyA" })).toEqual({ dx: -1, dy: 0 });
    expect(deltaForKey({ key: "d", code: "KeyD" })).toEqual({ dx: 1, dy: 0 });
    // Caps Lock: the key arrives upper-case and still counts.
    expect(deltaForKey({ key: "D", code: "KeyD" })).toEqual({ dx: 1, dy: 0 });
  });

  it("maps QEZC and the numpad corners to one-press diagonals", () => {
    expect(deltaForKey({ key: "q", code: "KeyQ" })).toEqual({ dx: -1, dy: -1 });
    expect(deltaForKey({ key: "e", code: "KeyE" })).toEqual({ dx: 1, dy: -1 });
    expect(deltaForKey({ key: "z", code: "KeyZ" })).toEqual({ dx: -1, dy: 1 });
    expect(deltaForKey({ key: "c", code: "KeyC" })).toEqual({ dx: 1, dy: 1 });
    // A numpad digit's `key` is "7" (or "Home" with NumLock off) — the CODE is
    // what names the key, so both arrive here as up-left.
    expect(deltaForKey({ key: "7", code: "Numpad7" })).toEqual({ dx: -1, dy: -1 });
    expect(deltaForKey({ key: "Home", code: "Numpad7" })).toEqual({ dx: -1, dy: -1 });
    expect(deltaForKey({ key: "3", code: "Numpad3" })).toEqual({ dx: 1, dy: 1 });
    expect(deltaForKey({ key: "8", code: "Numpad8" })).toEqual({ dx: 0, dy: -1 });
  });

  it("is null for every other key — a main-row digit, Enter, g, Escape", () => {
    expect(deltaForKey({ key: "7", code: "Digit7" })).toBeNull();
    expect(deltaForKey({ key: "Enter", code: "Enter" })).toBeNull();
    expect(deltaForKey({ key: "g", code: "KeyG" })).toBeNull();
    expect(deltaForKey({ key: "Escape", code: "Escape" })).toBeNull();
  });
});

describe("movableSelection", () => {
  it("a player moves their own token, a shared prop and their own prop — nothing else", () => {
    const ids = ["token:mine", "token:theirs", "prop:shared", "prop:dmonly", "prop:myprop"];
    expect(
      movableSelection({
        selectedObjectIds: ids,
        snapshot: snapshot({ playerPropsEnabled: true }),
        uid: "me",
        isDM: false,
      }),
    ).toEqual(["token:mine", "prop:shared", "prop:myprop"]);
  });

  it("with the player-props switch off a player still moves a SHARED prop, never their own", () => {
    const ids = ["token:mine", "prop:shared", "prop:myprop"];
    expect(
      movableSelection({ selectedObjectIds: ids, snapshot: snapshot(), uid: "me", isDM: false }),
    ).toEqual(["token:mine", "prop:shared"]);
  });

  it("the DM moves all of them", () => {
    const ids = ["token:mine", "token:theirs", "prop:shared", "prop:dmonly", "prop:myprop"];
    const out = movableSelection({
      selectedObjectIds: ids,
      snapshot: snapshot(),
      uid: "dm",
      isDM: true,
    });
    expect(out).toEqual(ids);
  });

  it("a locked object is the DM's only", () => {
    const locked = snapshot({
      sceneObjects: [{ id: "token:mine", locked: true }] as unknown as RoomSnapshot["sceneObjects"],
    });
    expect(
      movableSelection({
        selectedObjectIds: ["token:mine"],
        snapshot: locked,
        uid: "me",
        isDM: false,
      }),
    ).toEqual([]);
    expect(
      movableSelection({
        selectedObjectIds: ["token:mine"],
        snapshot: locked,
        uid: "dm",
        isDM: true,
      }),
    ).toEqual(["token:mine"]);
  });

  it("ignores ids that are not tokens or props, unknown ids, and a null snapshot", () => {
    const ids = ["drawing:d1", "map", "token:ghost", "prop:ghost"];
    expect(
      movableSelection({ selectedObjectIds: ids, snapshot: snapshot(), uid: "dm", isDM: true }),
    ).toEqual([]);
    expect(
      movableSelection({
        selectedObjectIds: ["token:mine"],
        snapshot: null,
        uid: "me",
        isDM: false,
      }),
    ).toEqual([]);
  });
});

describe("ownTokenFallback — nothing selected → your own token", () => {
  it("names the actor's one PC character's LINKED token — not merely the first token they own", () => {
    // "spare" sorts first and is mine too; the link decides (round 1: every
    // fixture's linked token was also the first owned one, so the link clause
    // was unpinned).
    const snap = snapshot({
      tokens: tokens([
        ["spare", "me"],
        ["mine", "me"],
      ]),
      characters: characters([{ id: "hero", type: "pc", owner: "me", tokenId: "mine" }]),
    });
    expect(ownTokenFallback({ snapshot: snap, uid: "me" })).toBe("token:mine");
  });

  it("a link to a token the snapshot lacks (stashed by a scene capture) answers nothing", () => {
    const snap = snapshot({
      characters: characters([{ id: "hero", type: "pc", owner: "me", tokenId: "ghost" }]),
    });
    expect(ownTokenFallback({ snapshot: snap, uid: "me" })).toBeNull();
  });

  it("predates linking: the one token the actor owns — a stranger's token sorting first is not it", () => {
    const snap = snapshot({
      tokens: tokens([
        ["theirs", "them"],
        ["mine", "me"],
      ]),
      characters: characters([{ id: "hero", type: "pc", owner: "me", tokenId: null }]),
    });
    expect(ownTokenFallback({ snapshot: snap, uid: "me" })).toBe("token:mine");
  });

  it("predates linking: a token another character claims is not loose — a DM's goblin is the DM's uid, never their token", () => {
    // NPC tokens carry the placing DM's uid and are linked to their NPC
    // character (placeNPCToken). Round 1's critical: "owned by me" alone
    // handed a DM whose own token was deleted the first goblin.
    const dmWithGoblin = snapshot({
      tokens: tokens([["goblin", "me"]]),
      characters: characters([
        { id: "hero", type: "pc", owner: "me", tokenId: null },
        { id: "gob", type: "npc", owner: null, tokenId: "goblin" },
      ]),
    });
    expect(ownTokenFallback({ snapshot: dmWithGoblin, uid: "me" })).toBeNull();
    const dmWithGoblinAndLoose = snapshot({
      tokens: tokens([
        ["goblin", "me"],
        ["mine", "me"],
      ]),
      characters: characters([
        { id: "hero", type: "pc", owner: "me", tokenId: null },
        { id: "gob", type: "npc", owner: null, tokenId: "goblin" },
      ]),
    });
    expect(ownTokenFallback({ snapshot: dmWithGoblinAndLoose, uid: "me" })).toBe("token:mine");
  });

  it("predates linking: two loose tokens of mine is a guess — nothing answers", () => {
    const snap = snapshot({
      tokens: tokens([
        ["mine", "me"],
        ["mine2", "me"],
      ]),
      characters: characters([{ id: "hero", type: "pc", owner: "me", tokenId: null }]),
    });
    expect(ownTokenFallback({ snapshot: snap, uid: "me" })).toBeNull();
  });

  it("is null with two PCs (a guess is wrong for one of them), with none, and without a snapshot", () => {
    const two = snapshot({
      characters: characters([
        { id: "a", type: "pc", owner: "me", tokenId: "mine" },
        { id: "b", type: "pc", owner: "me", tokenId: "theirs" },
      ]),
    });
    expect(ownTokenFallback({ snapshot: two, uid: "me" })).toBeNull();
    expect(ownTokenFallback({ snapshot: snapshot(), uid: "me" })).toBeNull();
    expect(ownTokenFallback({ snapshot: null, uid: "me" })).toBeNull();
  });

  it("an NPC character recorded as owned by the actor never counts (a fixture-only shape — production NPCs are unowned; their TOKENS are the case above)", () => {
    const withNpc = snapshot({
      characters: characters([
        { id: "hero", type: "pc", owner: "me", tokenId: "mine" },
        { id: "goblin", type: "npc", owner: "me", tokenId: "theirs" },
      ]),
    });
    expect(ownTokenFallback({ snapshot: withNpc, uid: "me" })).toBe("token:mine");
    const onlyNpc = snapshot({
      characters: characters([{ id: "goblin", type: "npc", owner: "me", tokenId: "theirs" }]),
    });
    expect(ownTokenFallback({ snapshot: onlyNpc, uid: "me" })).toBeNull();
  });

  it("someone else's PC is not mine, and a lone unlinked PC with no owned token is null", () => {
    const theirs = snapshot({
      characters: characters([{ id: "hero", type: "pc", owner: "them", tokenId: "theirs" }]),
    });
    expect(ownTokenFallback({ snapshot: theirs, uid: "me" })).toBeNull();
    const noToken = snapshot({
      tokens: [],
      characters: characters([{ id: "hero", type: "pc", owner: "me", tokenId: null }]),
    });
    expect(ownTokenFallback({ snapshot: noToken, uid: "me" })).toBeNull();
  });
});
