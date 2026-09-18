// ENTRY RECENTER (UX-08). Joining or reloading a fogged map used to leave the
// camera wherever it defaults: a black rectangle with your own token somewhere
// off-screen, which reads as a table that failed to load rather than one you
// cannot see yet. The audit's player assumed an empty game, and the only way
// back was an icon-only control on the character card.
//
// The rule is deliberately narrow: the FIRST snapshot this client receives, and
// never again. A map published later is a first bind, and the travel recenter
// has always chosen not to move the camera for one.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { useCameraCommands } from "../useCameraCommands";

const SCENE = {
  schemaVersion: 1,
  sourceDocumentId: "doc-a",
  sourceRevision: 0,
  compiledAt: 0,
  width: 2000,
  height: 1000,
  walls: [],
  doors: [],
  lights: [],
};

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    pointers: [],
    gridSize: 50,
    diceRolls: [],
    compiledScene: SCENE,
    ...overrides,
  } as RoomSnapshot;
}

/** A PC owned by `uid`, linked to a token — the shape ownTokenFallback wants. */
function withOwnToken(uid: string, tokenId = "tok-mine") {
  return snapshot({
    characters: [{ id: "char-1", type: "pc", ownedByPlayerUID: uid, tokenId }] as never,
    tokens: [{ id: tokenId, owner: uid, x: 10, y: 20 }] as never,
  });
}

// FIXTURES ARE HOISTED OUT OF EVERY RENDER CLOSURE ON PURPOSE. Building a
// snapshot inside the callback gives the effect a new deps identity on every
// render, so a broken once-only latch loops effect -> setState -> render ->
// effect and starves the event loop. That is a HUNG worker, not a red test, and
// a per-test timeout cannot fire through it. With the fixture hoisted, the same
// break fails "fires once" with a real assertion.
describe("useCameraCommands entry recenter", () => {
  it("focuses the viewer's own token on the first snapshot", () => {
    const s = withOwnToken("u");
    const { result } = renderHook(() => useCameraCommands({ snapshot: s, uid: "u" }));
    expect(result.current.cameraCommand).toEqual({ type: "focus-token", tokenId: "tok-mine" });
  });

  it("falls back to the staging zone when the viewer has no token of their own", () => {
    const s = snapshot({ playerStagingZone: { x: 12, y: 14, width: 4, height: 4, rotation: 0 } });
    const { result } = renderHook(() => useCameraCommands({ snapshot: s, uid: "dm" }));
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 625, y: 725 });
  });

  it("leaves the camera alone with no own token and no staging zone", () => {
    // NOT the scene's middle. Travel uses that fallback because the old map's
    // pan is certainly wrong on the new one; entry has no such certainty, and
    // on a big authoring map the middle is empty. Measured on a live 8192x8192
    // table, this fallback parked a DM at (4096, 4096) while the doors they had
    // just drawn sat at (400, 200) — off screen, and worse than not moving.
    const s = snapshot();
    const { result } = renderHook(() => useCameraCommands({ snapshot: s, uid: "dm" }));
    expect(result.current.cameraCommand).toBeNull();

    // POSITIVE CONTROL: the same fixture plus a staging zone must produce a
    // command, or this test cannot tell "correctly quiet" from "feature gone".
    const withZone = snapshot({
      playerStagingZone: { x: 12, y: 14, width: 4, height: 4, rotation: 0 },
    });
    const live = renderHook(() => useCameraCommands({ snapshot: withZone, uid: "dm" }));
    expect(live.result.current.cameraCommand).toEqual({ type: "focus-point", x: 625, y: 725 });
  });

  it("does NOT send a DM to a token they placed for an NPC", () => {
    // The staging zone is what they get instead, so the assertion below is
    // about WHICH target wins, not about whether anything happens.
    // Every NPC token carries the uid of the DM who placed it, so a plain
    // `owner === uid` test picks the goblin. F4 settled this once already.
    const s = snapshot({
      characters: [{ id: "npc-1", type: "npc", ownedByPlayerUID: "dm" }] as never,
      tokens: [{ id: "tok-goblin", owner: "dm", x: 3, y: 4 }] as never,
      playerStagingZone: { x: 12, y: 14, width: 4, height: 4, rotation: 0 },
    });
    const { result } = renderHook(() => useCameraCommands({ snapshot: s, uid: "dm" }));
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 625, y: 725 });
  });

  it("fires once: a later snapshot does not yank the camera back", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useCameraCommands({ snapshot: s, uid: "u" }),
      { initialProps: { s: withOwnToken("u") } },
    );
    expect(result.current.cameraCommand).toEqual({ type: "focus-token", tokenId: "tok-mine" });
    act(() => result.current.handleCameraCommandHandled());

    rerender({ s: withOwnToken("u") });
    expect(result.current.cameraCommand).toBeNull();
  });

  it("does nothing on a table with no map, even when the viewer has a token", () => {
    // A table hands every new arrival a token at (0,0) before any map exists.
    // Aiming at it would park the view off the document created a moment
    // later — which is what the mobile map-edit specs caught: taps landing
    // outside the new map, painting nothing. No scene, no aim.
    const noMap = { ...withOwnToken("u"), compiledScene: undefined } as RoomSnapshot;
    const { result } = renderHook(() => useCameraCommands({ snapshot: noMap, uid: "u" }));
    expect(result.current.cameraCommand).toBeNull();

    // POSITIVE CONTROL: identical but WITH a scene. Without this the test is
    // green whether the effect is bounded or absent.
    const withMap = withOwnToken("u");
    const live = renderHook(() => useCameraCommands({ snapshot: withMap, uid: "u" }));
    expect(live.result.current.cameraCommand).toEqual({
      type: "focus-token",
      tokenId: "tok-mine",
    });
  });

  it("stands down for good when the first snapshot has nothing to aim at", () => {
    // A table with no map yet. Publishing one later is a first bind, and the
    // travel recenter deliberately leaves the camera alone for those.
    const empty = snapshot({ compiledScene: undefined as never });
    const { result, rerender } = renderHook(
      ({ s }) => useCameraCommands({ snapshot: s, uid: "u" }),
      {
        initialProps: { s: empty },
      },
    );
    expect(result.current.cameraCommand).toBeNull();

    // The second snapshot must offer something entry WOULD aim at, or this
    // asserts null for the wrong reason: with a bare snapshot() there is no own
    // token and no staging zone, so the latch could be broken and the test
    // would still pass.
    rerender({ s: withOwnToken("u") });
    expect(result.current.cameraCommand).toBeNull();
  });

  it("waits for a snapshot rather than aiming at nothing", () => {
    const { result, rerender } = renderHook(
      ({ s }: { s: RoomSnapshot | null }) => useCameraCommands({ snapshot: s, uid: "u" }),
      { initialProps: { s: null as RoomSnapshot | null } },
    );
    expect(result.current.cameraCommand).toBeNull();

    rerender({ s: withOwnToken("u") });
    expect(result.current.cameraCommand).toEqual({ type: "focus-token", tokenId: "tok-mine" });
  });
});
