// ============================================================================
// MAP IMPORT — tell the DM which file they picked
// ============================================================================
// HeroByte writes two backups and both declare `schemaVersion: 1`, so the
// version check this importer used to lead with could not tell them apart. A
// whole table backup passed it, went to the wire as a map document, and came
// back as THE MAP SERVER DID NOT RESPOND — a message about the connection, for
// a file that was never a map. These tests hold the line that a wrong-kind file
// is named locally and never sent.

import { describe, it, expect } from "vitest";
import { parseBackupImport } from "../importBackup";

const MAP = {
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

const SESSION = {
  schemaVersion: 1,
  savedAt: 1,
  snapshot: { users: [], tokens: [], players: [], characters: [], gridSize: 50 },
  mapDocuments: [MAP],
};

describe("parseBackupImport", () => {
  it("imports a map backup", () => {
    expect(parseBackupImport(JSON.stringify(MAP))).toEqual({ document: MAP });
  });

  // THE LINE THIS MUST NOT CROSS. MapStudioControl's own tests import backups
  // as thin as `{ schemaVersion: 1, id, name }`, and the server is the real
  // validator — a stricter check here refuses a file that would have worked,
  // with nowhere to appeal. Detection may reject the session file and nothing
  // else.
  it("still accepts a partial map backup, the way it always has", () => {
    const thin = { schemaVersion: 1, id: "orig", name: "Restored" };
    expect(parseBackupImport(JSON.stringify(thin))).toEqual({ document: thin });

    const noLayers = { schemaVersion: 1, id: "orig", name: "Restored", elements: [] };
    expect(parseBackupImport(JSON.stringify(noLayers))).toEqual({ document: noLayers });
  });

  it("names a table backup as a table backup, and sends nothing", () => {
    const result = parseBackupImport(JSON.stringify(SESSION));
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/table backup/i);
    // It must point at the control that WOULD work, or the only move left is
    // to pick the same file again.
    expect((result as { error: string }).error).toMatch(/Load Game State/);
    expect(result).not.toHaveProperty("document");
  });

  it("rejects a bare snapshot from an older save the same way", () => {
    const bare = { users: [], tokens: [], players: [], characters: [], gridSize: 50 };
    expect((parseBackupImport(JSON.stringify(bare)) as { error: string }).error).toMatch(
      /table backup/i,
    );
  });

  it("separates a map from a newer HeroByte from a file that is not a map at all", () => {
    const future = { ...MAP, schemaVersion: 2 };
    expect((parseBackupImport(JSON.stringify(future)) as { error: string }).error).toMatch(
      /different version/i,
    );
    expect((parseBackupImport('{"hello":"world"}') as { error: string }).error).toMatch(
      /not a HeroByte map/i,
    );
  });

  it("rejects invalid JSON", () => {
    expect((parseBackupImport("{ nope") as { error: string }).error).toMatch(/not valid JSON/i);
  });
});
