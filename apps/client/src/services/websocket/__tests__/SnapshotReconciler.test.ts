import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoomSnapshot } from "@shared";
import { SnapshotReconciler } from "../SnapshotReconciler";

function createSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    users: [],
    stateVersion: 1,
    tokens: [],
    players: [],
    characters: [],
    pointers: [],
    drawings: [],
    gridSize: 50,
    diceRolls: [],
    sceneObjects: [],
    ...overrides,
  };
}

describe("SnapshotReconciler", () => {
  let onSnapshot: ReturnType<typeof vi.fn>;
  let requestResync: ReturnType<typeof vi.fn>;
  let reconciler: SnapshotReconciler;

  beforeEach(() => {
    onSnapshot = vi.fn();
    requestResync = vi.fn();
    reconciler = new SnapshotReconciler({
      onSnapshot,
      requestResync,
    });
  });

  it("applies sequential token deltas without requesting resync", () => {
    const snapshot = createSnapshot({
      stateVersion: 5,
      tokens: [{ id: "token-1", owner: "p1", x: 0, y: 0, color: "#fff" }],
    });
    reconciler.applySnapshot(snapshot);
    onSnapshot.mockClear();

    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 6,
      token: { id: "token-1", owner: "p1", x: 10, y: 20, color: "#000" },
    });

    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        stateVersion: 6,
        tokens: [{ id: "token-1", owner: "p1", x: 10, y: 20, color: "#000" }],
      }),
    );
    expect(requestResync).not.toHaveBeenCalled();
  });

  it("requests resync when delta arrives without a base snapshot", () => {
    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 2,
      token: { id: "token-1", owner: "p1", x: 5, y: 5, color: "#fff" },
    });

    expect(requestResync).toHaveBeenCalledWith({
      lastSeenVersion: 0,
      receivedVersion: 2,
      reason: "no-base-snapshot",
    });
  });

  it("only requests resync once per gap until a new snapshot arrives", () => {
    const snapshot = createSnapshot({ stateVersion: 3 });
    reconciler.applySnapshot(snapshot);
    requestResync.mockClear();

    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 5,
      token: { id: "token-gap", owner: "p-gap", x: 0, y: 0, color: "#111" },
    });
    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 6,
      token: { id: "token-1", owner: "p1", x: 0, y: 0, color: "#fff" },
    });

    expect(requestResync).toHaveBeenCalledTimes(1);

    reconciler.applySnapshot(createSnapshot({ stateVersion: 10 }));
    requestResync.mockClear();

    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 12,
      token: { id: "token-2", owner: "p2", x: 2, y: 2, color: "#123" },
    });

    expect(requestResync).toHaveBeenCalledOnce();
  });

  it("recovers after skipped messages by requesting resync and applying the next snapshot", () => {
    const baseSnapshot = createSnapshot({ stateVersion: 1 });
    reconciler.applySnapshot(baseSnapshot);

    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 2,
      token: { id: "token-1", owner: "p1", x: 1, y: 1, color: "#111" },
    });
    requestResync.mockClear();

    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 4,
      token: { id: "token-2", owner: "p2", x: 3, y: 3, color: "#222" },
    });

    expect(requestResync).toHaveBeenCalledWith({
      lastSeenVersion: 2,
      receivedVersion: 4,
      reason: "version-gap",
    });

    const recoverySnapshot = createSnapshot({
      stateVersion: 10,
      tokens: [
        { id: "token-1", owner: "p1", x: 2, y: 2, color: "#333" },
        { id: "token-2", owner: "p2", x: 4, y: 4, color: "#444" },
      ],
    });
    reconciler.applySnapshot(recoverySnapshot);
    onSnapshot.mockClear();

    reconciler.applyDelta({
      t: "token-updated",
      stateVersion: 11,
      token: { id: "token-2", owner: "p2", x: 10, y: 10, color: "#555" },
    });

    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        stateVersion: 11,
        tokens: [
          { id: "token-1", owner: "p1", x: 2, y: 2, color: "#333" },
          { id: "token-2", owner: "p2", x: 10, y: 10, color: "#555" },
        ],
      }),
    );
  });

  it("hydrates heavy fields from snapshot assets", () => {
    const snapshot = createSnapshot({
      stateVersion: 4,
      assets: [
        {
          id: "map-background:aaa",
          type: "map-background",
          hash: "aaa",
          size: 10,
          payload: "https://example.com/map.png",
        },
        {
          id: "drawings:bbb",
          type: "drawings",
          hash: "bbb",
          size: 10,
          payload: [
            {
              id: "drawing-1",
              type: "freehand",
              points: [{ x: 0, y: 0 }],
              color: "#fff",
              width: 2,
              opacity: 1,
            },
          ],
        },
      ],
      assetRefs: {
        "map-background": "map-background:aaa",
        drawings: "drawings:bbb",
      },
      drawings: undefined,
      mapBackground: undefined,
    });

    reconciler.applySnapshot(snapshot);

    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        mapBackground: "https://example.com/map.png",
        drawings: [
          expect.objectContaining({ id: "drawing-1", type: "freehand" }),
        ],
      }),
    );
  });

  it("reuses cached assets when snapshot omits payload", () => {
    const firstSnapshot = createSnapshot({
      stateVersion: 1,
      assets: [
        {
          id: "map-background:aaa",
          type: "map-background",
          hash: "aaa",
          size: 10,
          payload: "https://example.com/map.png",
        },
      ],
      assetRefs: {
        "map-background": "map-background:aaa",
      },
      mapBackground: undefined,
    });
    reconciler.applySnapshot(firstSnapshot);
    onSnapshot.mockClear();

    const secondSnapshot = createSnapshot({
      stateVersion: 2,
      assets: [],
      assetRefs: {
        "map-background": "map-background:aaa",
      },
      mapBackground: undefined,
    });

    reconciler.applySnapshot(secondSnapshot);

    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        mapBackground: "https://example.com/map.png",
      }),
    );
  });

  it("applies pointer previews without requiring deltas", () => {
    const snapshot = createSnapshot({
      stateVersion: 2,
      pointers: [],
    });
    reconciler.applySnapshot(snapshot);
    onSnapshot.mockClear();

    reconciler.applyPointerPreview({
      id: "pointer-1",
      uid: "player-1",
      x: 10,
      y: 20,
      timestamp: 111,
      name: "Alice",
    });

    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        pointers: [
          expect.objectContaining({ id: "pointer-1", x: 10, y: 20, uid: "player-1" }),
        ],
      }),
    );
  });

  it("applies drag previews to tokens and scene objects", () => {
    const snapshot = createSnapshot({
      stateVersion: 3,
      tokens: [
        {
          id: "token-1",
          owner: "player-1",
          x: 0,
          y: 0,
          color: "#fff",
          size: "medium",
        },
      ],
      sceneObjects: [
        {
          id: "token:token-1",
          type: "token",
          owner: "player-1",
          locked: false,
          zIndex: 10,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { color: "#fff", imageUrl: undefined },
        },
      ],
    });
    reconciler.applySnapshot(snapshot);
    onSnapshot.mockClear();

    reconciler.applyDragPreview({
      uid: "player-2",
      timestamp: 123,
      objects: [
        { tokenId: "token-1", id: "token:token-1", x: 5, y: 7 },
      ],
    });

    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: [expect.objectContaining({ id: "token-1", x: 5, y: 7 })],
        sceneObjects: [
          expect.objectContaining({
            id: "token:token-1",
            transform: expect.objectContaining({ x: 5, y: 7 }),
          }),
        ],
        stateVersion: 3,
      }),
    );
  });
});
