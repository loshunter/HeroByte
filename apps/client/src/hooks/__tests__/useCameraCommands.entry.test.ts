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

describe("useCameraCommands entry recenter", () => {
  it("focuses the viewer's own token on the first snapshot", () => {
    const { result } = renderHook(() =>
      useCameraCommands({ snapshot: withOwnToken("u"), uid: "u" }),
    );
    expect(result.current.cameraCommand).toEqual({ type: "focus-token", tokenId: "tok-mine" });
  });

  it("falls back to the staging zone when the viewer has no token of their own", () => {
    const { result } = renderHook(() =>
      useCameraCommands({
        snapshot: snapshot({
          playerStagingZone: { x: 12, y: 14, width: 4, height: 4, rotation: 0 },
        }),
        uid: "dm",
      }),
    );
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 625, y: 725 });
  });

  it("falls back to the scene's middle when there is no staging zone either", () => {
    const { result } = renderHook(() => useCameraCommands({ snapshot: snapshot(), uid: "dm" }));
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 1000, y: 500 });
  });

  it("does NOT send a DM to a token they placed for an NPC", () => {
    // Every NPC token carries the uid of the DM who placed it, so a plain
    // `owner === uid` test picks the goblin. F4 settled this once already.
    const { result } = renderHook(() =>
      useCameraCommands({
        snapshot: snapshot({
          characters: [{ id: "npc-1", type: "npc", ownedByPlayerUID: "dm" }] as never,
          tokens: [{ id: "tok-goblin", owner: "dm", x: 3, y: 4 }] as never,
        }),
        uid: "dm",
      }),
    );
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 1000, y: 500 });
  });

  it("fires once: a later snapshot does not yank the camera back", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useCameraCommands({ snapshot: s, uid: "u" }),
      {
        initialProps: { s: withOwnToken("u") },
      },
    );
    expect(result.current.cameraCommand).toEqual({ type: "focus-token", tokenId: "tok-mine" });
    act(() => result.current.handleCameraCommandHandled());

    rerender({ s: withOwnToken("u") });
    expect(result.current.cameraCommand).toBeNull();
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

    rerender({ s: snapshot() });
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
