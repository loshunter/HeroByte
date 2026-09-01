// The travel-arrival recenter (A5): when the PLAYER-VISIBLE scene id moves
// between two defined values, the camera gets a focus-point command at the
// destination's staging-zone center (cells → world px), else the scene's
// middle. First bind and reload (undefined→A) deliberately do not fire.

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { useCameraCommands } from "../useCameraCommands";

function snapshotWith(
  sourceDocumentId: string | undefined,
  overrides: Partial<RoomSnapshot> = {},
): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    pointers: [],
    gridSize: 50,
    diceRolls: [],
    ...(sourceDocumentId
      ? {
          compiledScene: {
            schemaVersion: 1,
            sourceDocumentId,
            sourceRevision: 0,
            compiledAt: 0,
            width: 2000,
            height: 1000,
            walls: [],
            doors: [],
            lights: [],
          },
        }
      : {}),
    ...overrides,
  } as RoomSnapshot;
}

describe("useCameraCommands travel recenter", () => {
  it("does NOT fire on the first bind (undefined→A)", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useCameraCommands({ snapshot: s, uid: "u" }),
      {
        initialProps: { s: snapshotWith(undefined) },
      },
    );
    rerender({ s: snapshotWith("doc-a") });
    expect(result.current.cameraCommand).toBeNull();
  });

  it("recenters on the SCENE middle when the destination has no staging zone", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useCameraCommands({ snapshot: s, uid: "u" }),
      {
        initialProps: { s: snapshotWith("doc-a") },
      },
    );
    rerender({ s: snapshotWith("doc-b") });
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 1000, y: 500 });
  });

  it("prefers the staging zone's center — cell-space, center-anchored, so (12,14) is world (625,725)", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useCameraCommands({ snapshot: s, uid: "u" }),
      {
        initialProps: { s: snapshotWith("doc-a") },
      },
    );
    rerender({
      s: snapshotWith("doc-b", {
        playerStagingZone: { x: 12, y: 14, width: 4, height: 4, rotation: 0 },
      }),
    });
    expect(result.current.cameraCommand).toEqual({ type: "focus-point", x: 625, y: 725 });
  });
});
