/**
 * sessionExport — the one author of a SessionFile, and the mint ceiling's
 * weigh-in against it.
 *
 * The export's CONTENT is characterized end to end by
 * ws/__tests__/sessionRoundTrip.contract.test.ts (flattened drawings, stripped
 * whispers and private rolls, kept mapBackground, envelope-only sceneStates,
 * a file the loaders can read). This file pins what that suite cannot see
 * from the outside: the builder's direct contract, and that the weigher
 * measures the same builder the export uses — with the candidate documents
 * the caller hands it, so a mint is weighed BEFORE it exists.
 */
import { describe, it, expect, vi } from "vitest";
import {
  loadSessionFrameBytes,
  SESSION_MINT_CEILING_BYTES,
  type MapDocument,
  type SceneState,
} from "@herobyte/shared";
import { createEmptyRoomState, type RoomState } from "../model.js";
import {
  buildSessionFile,
  exportBytes,
  mintOverflow,
  mintRefusal,
  withCandidate,
} from "../sessionExport.js";

const DM = "dm-uid";

function scene(documentId: string): SceneState {
  return {
    mapDocumentId: documentId,
    suspendedAt: 7,
    tokens: [],
    props: [],
    drawings: [],
    sceneObjects: [],
    characterLinks: {},
    doorStates: {},
    combatActive: false,
    initiatives: {},
    fogEnabled: false,
    defaultVisionRadius: null,
  } as unknown as SceneState;
}

function document(id: string, name = id): MapDocument {
  return { id, name } as unknown as MapDocument;
}

function stateWith(overrides: Partial<RoomState> = {}): RoomState {
  return {
    ...createEmptyRoomState(),
    players: [
      {
        uid: DM,
        name: "DM",
        isDM: true,
        hp: 10,
        maxHp: 10,
        micLevel: 0,
        lastHeartbeat: 0,
        statusEffects: [],
      } as never,
    ],
    ...overrides,
  };
}

describe("buildSessionFile", () => {
  it("bundles the documents it is handed, the binding, and only schema-conforming scenes — loudly", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const state = stateWith({
        liveMapDocumentId: "doc-A",
        sceneStates: {
          "doc-B": scene("doc-B"),
          "doc-C": { mapDocumentId: "doc-C", tokens: "not-an-array" } as never,
        },
      });
      const documents = [document("doc-A"), document("doc-B")];

      const file = buildSessionFile(state, documents, DM, 1234);

      expect(file.schemaVersion).toBe(1);
      expect(file.savedAt).toBe(1234);
      expect(file.mapDocuments).toBe(documents);
      expect(file.liveMapDocumentId).toBe("doc-A");
      expect(file.sceneStates?.map((entry) => entry.mapDocumentId)).toEqual(["doc-B"]);
      expect(warn).toHaveBeenCalledWith("session-export: skipped a malformed suspended scene");
      // A file, not a wire frame: the asset channel is flattened away.
      expect("assets" in file.snapshot).toBe(false);
      expect("assetRefs" in file.snapshot).toBe(false);
      expect(Array.isArray(file.snapshot.drawings)).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it("omits the sceneStates key entirely when no scene is suspended (a pre-Atlas file is byte-identical)", () => {
    const file = buildSessionFile(stateWith(), [], DM, 0);
    expect("sceneStates" in file).toBe(false);
  });
});

describe("mintOverflow", () => {
  it("weighs the export the CANDIDATE list would write, with the same builder the export uses", () => {
    const state = stateWith({ liveMapDocumentId: "doc-A" });
    const small = [document("doc-A")];

    expect(mintOverflow(state, small, DM)).toBeNull();

    // A candidate the caller has already added: one document heavy enough on
    // its own. The weigh must see it, though nothing in the room holds it.
    const fat = document("doc-fat", "n".repeat(SESSION_MINT_CEILING_BYTES));
    const overflow = mintOverflow(state, [...small, fat], DM);

    expect(overflow).not.toBeNull();
    expect(overflow!.ceiling).toBe(SESSION_MINT_CEILING_BYTES);
    expect(overflow!.bytes).toBeGreaterThan(SESSION_MINT_CEILING_BYTES);
    // Exactly the frame's bytes — not the file's, not a guess.
    expect(overflow!.bytes).toBe(
      loadSessionFrameBytes(buildSessionFile(state, [...small, fat], DM, 0)),
    );
  });

  it("counts the candidate's LIVE-scene bytes — what the travel installs beside the document", () => {
    const state = stateWith({ liveMapDocumentId: "doc-A" });
    const documents = [document("doc-A"), document("doc-B")];
    const base = exportBytes(state, documents, DM);
    const room = SESSION_MINT_CEILING_BYTES - base;

    expect(mintOverflow(state, documents, DM, room)).toBeNull();
    const overflow = mintOverflow(state, documents, DM, room + 1);
    expect(overflow).not.toBeNull();
    expect(overflow!.bytes).toBe(SESSION_MINT_CEILING_BYTES + 1);
  });

  it("counts suspended scenes and the snapshot too — the export is more than its documents", () => {
    const heavyScene = {
      ...scene("doc-B"),
      drawings: Array.from({ length: 200 }, (_, i) => ({
        id: `d-${i}`,
        type: "freehand",
        points: Array.from({ length: 200 }, (_, p) => ({ x: p, y: p })),
        color: "#ffffff",
        width: 2,
        opacity: 1,
      })),
    } as unknown as SceneState;
    const light = stateWith({ liveMapDocumentId: "doc-A" });
    const heavy = stateWith({ liveMapDocumentId: "doc-A", sceneStates: { "doc-B": heavyScene } });
    const documents = [document("doc-A"), document("doc-B")];

    const lightBytes = loadSessionFrameBytes(buildSessionFile(light, documents, DM, 0));
    const heavyBytes = loadSessionFrameBytes(buildSessionFile(heavy, documents, DM, 0));
    expect(heavyBytes - lightBytes).toBeGreaterThan(100_000);
  });
});

describe("withCandidate", () => {
  it("appends a new document and REPLACES one that already exists by id — a generate weighs the after, not the before", () => {
    const a = document("doc-A", "a");
    const b = document("doc-B", "b");
    const grownB = document("doc-B", "b".repeat(1000));

    expect(withCandidate([a], b)).toEqual([a, b]);
    const replaced = withCandidate([a, b], grownB);
    expect(replaced).toHaveLength(2);
    expect(replaced[1]).toBe(grownB);
    // Never both versions of one document.
    expect(replaced.filter((entry) => entry.id === "doc-B")).toHaveLength(1);
  });
});

describe("mintRefusal", () => {
  it("says both numbers in megabytes and what to do", () => {
    const said = mintRefusal({ bytes: 900_000, ceiling: SESSION_MINT_CEILING_BYTES });
    expect(said).toContain("0.86 MB");
    expect(said).toContain("0.75 MB");
    expect(said).toContain("Delete a map first");
  });
});
