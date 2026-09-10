// The pure rules under keyboard movement: which key names which cell delta,
// and who may move what (mirroring the server's TransformHandler so no dead
// round trip is sent). Where the cell IS is the server's business now.

import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { deltaForKey, movableSelection } from "../keyboardMovement";

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
