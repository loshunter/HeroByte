// The pure rules under keyboard movement: which key names which cell delta,
// who may move what (mirroring the server's TransformHandler so no dead
// round trip is sent), and where a chained press starts from.

import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import {
  PENDING_STEP_MAX_DEPTH,
  PENDING_STEP_TTL_MS,
  deltaForKey,
  movableSelection,
  nextPendingStep,
  stepOrigin,
  type CellDelta,
  type PendingStep,
} from "../keyboardMovement";

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
    ).toEqual([
      { id: "token:mine", x: 3, y: 4 },
      { id: "prop:shared", x: 1, y: 1 },
      { id: "prop:myprop", x: 5, y: 6 },
    ]);
  });

  it("a player moves no prop at all while the table's player-props switch is off", () => {
    const ids = ["token:mine", "prop:shared", "prop:myprop"];
    expect(
      movableSelection({ selectedObjectIds: ids, snapshot: snapshot(), uid: "me", isDM: false }),
    ).toEqual([{ id: "token:mine", x: 3, y: 4 }]);
  });

  it("the DM moves all of them", () => {
    const ids = ["token:mine", "token:theirs", "prop:shared", "prop:dmonly", "prop:myprop"];
    const out = movableSelection({
      selectedObjectIds: ids,
      snapshot: snapshot(),
      uid: "dm",
      isDM: true,
    });
    expect(out.map((o) => o.id)).toEqual(ids);
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
    ).toEqual([{ id: "token:mine", x: 3, y: 4 }]);
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

describe("stepOrigin — the chain", () => {
  const right: CellDelta = { dx: 1, dy: 0 };
  const down: CellDelta = { dx: 0, dy: 1 };
  const from = { x: 3, y: 4 };
  const chain = (to: { x: number; y: number }, startedAt = 1000): PendingStep => ({
    from,
    to,
    delta: right,
    startedAt,
  });

  it("chains from the last target while the snapshot still shows the chain's start", () => {
    expect(stepOrigin(from, chain({ x: 4, y: 4 }), right, 1050)).toEqual({ x: 4, y: 4 });
  });

  it("stays live while the snapshot is anywhere ON the path — an intermediate confirmed step", () => {
    // Two steps in flight, the first confirmed: the snapshot at (4,4) is on
    // the path (3,4)->(5,4), so the next press starts from (5,4), not (4,4).
    expect(stepOrigin({ x: 4, y: 4 }, chain({ x: 5, y: 4 }), right, 1050)).toEqual({ x: 5, y: 4 });
    // Fully caught up: the target itself.
    expect(stepOrigin({ x: 5, y: 4 }, chain({ x: 5, y: 4 }), right, 1050)).toEqual({ x: 5, y: 4 });
  });

  it("falls back to the snapshot when it is OFF the path — moved elsewhere, or past the target", () => {
    expect(stepOrigin({ x: 9, y: 9 }, chain({ x: 5, y: 4 }), right, 1050)).toEqual({ x: 9, y: 9 });
    expect(stepOrigin({ x: 4, y: 5 }, chain({ x: 5, y: 4 }), right, 1050)).toEqual({ x: 4, y: 5 });
    expect(stepOrigin({ x: 6, y: 4 }, chain({ x: 5, y: 4 }), right, 1050)).toEqual({ x: 6, y: 4 });
  });

  it("a turn starts over from the snapshot — a refused chain is never the origin of another direction", () => {
    // The teleport: a chain of refused steps east, then a press south used
    // to land (to.x, to.y + 1) — cells away from where the token really is.
    expect(stepOrigin(from, chain({ x: 7, y: 4 }), down, 1050)).toEqual(from);
  });

  it("expires by the chain's FIRST unconfirmed step, not its last press", () => {
    expect(
      stepOrigin(from, chain({ x: 4, y: 4 }, 1000), right, 1000 + PENDING_STEP_TTL_MS),
    ).toEqual({
      x: 4,
      y: 4,
    });
    expect(
      stepOrigin(from, chain({ x: 4, y: 4 }, 1000), right, 1000 + PENDING_STEP_TTL_MS + 1),
    ).toEqual(from);
    expect(stepOrigin(from, undefined, right, 1050)).toEqual(from);
  });

  it("caps how far a chain may run ahead of the snapshot", () => {
    const ahead = { x: from.x + PENDING_STEP_MAX_DEPTH - 1, y: 4 };
    expect(stepOrigin(from, chain(ahead), right, 1050)).toEqual(ahead);
    const tooFar = { x: from.x + PENDING_STEP_MAX_DEPTH, y: 4 };
    expect(stepOrigin(from, chain(tooFar), right, 1050)).toEqual(from);
  });

  it("nextPendingStep keeps the chain's start and clock only while something is unconfirmed", () => {
    const pending = chain({ x: 4, y: 4 }, 1000);
    // Continued: the origin was the chain's target and the snapshot lags.
    expect(nextPendingStep(from, { x: 4, y: 4 }, { x: 5, y: 4 }, right, pending, 1300)).toEqual({
      from,
      to: { x: 5, y: 4 },
      delta: right,
      startedAt: 1000,
    });
    // Caught up: a fresh chain from here, clock restarted.
    expect(
      nextPendingStep({ x: 4, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, right, pending, 1300),
    ).toEqual({ from: { x: 4, y: 4 }, to: { x: 5, y: 4 }, delta: right, startedAt: 1300 });
    // A turn: a fresh chain in the new direction.
    expect(nextPendingStep(from, from, { x: 3, y: 5 }, down, pending, 1300)).toEqual({
      from,
      to: { x: 3, y: 5 },
      delta: down,
      startedAt: 1300,
    });
  });
});
