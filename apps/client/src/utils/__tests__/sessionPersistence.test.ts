// ============================================================================
// SESSION PERSISTENCE — the round trip that has to be lossless
// ============================================================================
// A session file is the DM's workaround for an ephemeral server filesystem
// (DEPLOYMENT.md): a restart or idle spin-down loses room state, maps and
// secrets, so this file is how a table survives. If it drops a field, the DM
// finds out when their map comes back wrong — which is the worst possible time.
//
// The loader used to rebuild the snapshot from a hand-written field whitelist,
// so every field added after it was written was silently discarded. By the time
// the live-map arc shipped it was dropping the entire map. These tests exist to
// make that class of rot loud.

import { describe, it, expect } from "vitest";
import type { RoomSnapshot, SessionFile } from "@herobyte/shared";
import { loadSession } from "../sessionPersistence";

function fileOf(contents: unknown): File {
  return new File([JSON.stringify(contents)], "session.json", { type: "application/json" });
}

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    props: [],
    pointers: [],
    drawings: [],
    gridSize: 50,
    diceRolls: [],
    ...overrides,
  };
}

const MAP_ELEMENTS = {
  grid: { size: 50, offsetX: 0, offsetY: 0 },
  layers: [
    {
      opacity: 1,
      elements: [
        {
          id: "tile-1",
          type: "tile" as const,
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          data: { assetId: "tile:crate", columns: 1, rows: 1 },
        },
      ],
    },
  ],
};

const DOCUMENT = {
  schemaVersion: 1,
  id: "doc-A",
  name: "Dungeon",
  width: 2048,
  height: 2048,
  grid: {
    type: "square",
    size: 50,
    squareSize: 5,
    offsetX: 0,
    offsetY: 0,
    visible: true,
    snap: true,
  },
  layers: [
    {
      id: "walls",
      name: "walls",
      kind: "walls",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
    },
  ],
  elements: [],
  revision: 3,
  createdAt: 1,
  updatedAt: 2,
};

describe("loadSession", () => {
  it("preserves the whole map channel set, not a known-fields subset", () => {
    // THE REGRESSION GUARD. Each of these was dropped by the old whitelist, and
    // nothing said so — the file on disk was complete the entire time.
    const file: SessionFile = {
      schemaVersion: 1,
      savedAt: 123,
      snapshot: snapshot({
        mapElements: MAP_ELEMENTS,
        liveMapDocumentId: "doc-A",
        fogEnabled: true,
        combatActive: true,
        currentTurnCharacterId: "char-1",
      }),
      mapDocuments: [DOCUMENT as never],
      liveMapDocumentId: "doc-A",
    };

    return loadSession(fileOf(file)).then((loaded) => {
      expect(loaded.snapshot.mapElements).toEqual(MAP_ELEMENTS);
      expect(loaded.snapshot.liveMapDocumentId).toBe("doc-A");
      expect(loaded.snapshot.fogEnabled).toBe(true);
      expect(loaded.snapshot.combatActive).toBe(true);
      expect(loaded.snapshot.currentTurnCharacterId).toBe("char-1");
    });
  });

  it("carries the authored map documents, not just the derived map", () => {
    // Without these a restore onto a wiped server gives a map you can look at
    // but never edit, bound to a document that no longer exists.
    const file: SessionFile = {
      schemaVersion: 1,
      savedAt: 123,
      snapshot: snapshot(),
      mapDocuments: [DOCUMENT as never],
      liveMapDocumentId: "doc-A",
    };

    return loadSession(fileOf(file)).then((loaded) => {
      expect(loaded.mapDocuments).toHaveLength(1);
      expect(loaded.mapDocuments[0]?.id).toBe("doc-A");
      expect(loaded.liveMapDocumentId).toBe("doc-A");
    });
  });

  it("reads a legacy bare snapshot as a session with no maps", () => {
    // Files saved before the envelope existed are just a RoomSnapshot. They must
    // still load — the server clears the binding rather than dangling it.
    return loadSession(fileOf(snapshot({ gridSize: 70 }))).then((loaded) => {
      expect(loaded.snapshot.gridSize).toBe(70);
      expect(loaded.mapDocuments).toEqual([]);
      expect(loaded.liveMapDocumentId).toBeUndefined();
    });
  });

  it("loads a file with no drawings key at all", () => {
    // THE REGRESSION GUARD. The server's toSnapshot emits NO `drawings` key — a
    // room with none emits neither the key nor an assetRef. Requiring it here
    // rejected every file the export wrote, and only at restore time, after the
    // wipe the file existed to survive. This parser must never be stricter than
    // the server's own load validator.
    const { drawings: _drawings, ...noDrawings } = snapshot();

    return loadSession(fileOf(noDrawings)).then((loaded) => {
      expect(loaded.snapshot.drawings).toEqual([]);
    });
  });

  it("keeps a map background it cannot classify rather than dropping it", () => {
    // Coercing a non-plain-string background to undefined silently lost the map.
    // A file may carry it flattened OR via assetRefs; the server resolves both.
    return loadSession(
      fileOf({ ...snapshot(), assetRefs: { "map-background": "map-background:abc" } }),
    ).then((loaded) => {
      expect(loaded.snapshot.assetRefs).toEqual({ "map-background": "map-background:abc" });
    });
  });

  it("still rejects a file that is not a session at all", () => {
    return expect(loadSession(fileOf({ nonsense: true }))).rejects.toThrow();
  });

  it("still rejects a drawings key that is present but not an array", () => {
    return expect(loadSession(fileOf({ ...snapshot(), drawings: "nope" }))).rejects.toThrow(
      /drawings/,
    );
  });

  it("rejects a snapshot missing gridSize", () => {
    const { gridSize: _gridSize, ...withoutGrid } = snapshot();
    return expect(loadSession(fileOf(withoutGrid))).rejects.toThrow(/gridSize/);
  });

  it("still sanitizes the staging zone rather than trusting the file", () => {
    // Spreading the snapshot through must not lose the coercions the whitelist
    // used to do on the way past. A degenerate zone from a hand-edited file
    // would otherwise reach the server as-is.
    return loadSession(
      fileOf(
        snapshot({
          playerStagingZone: { x: 1, y: 2, width: -8, height: 0, rotation: "bad" } as never,
        }),
      ),
    ).then((loaded) => {
      expect(loaded.snapshot.playerStagingZone).toEqual({
        x: 1,
        y: 2,
        width: 8, // abs
        height: 0.5, // floored
        rotation: 0, // NaN → 0
      });
    });
  });

  it("drops a non-object staging zone", () => {
    return loadSession(fileOf(snapshot({ playerStagingZone: "nope" as never }))).then((loaded) => {
      expect(loaded.snapshot.playerStagingZone).toBeUndefined();
    });
  });
});
