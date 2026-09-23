// DRAFT ONLY. Relative imports target domains/map/__tests__/characterization/.
import { describe, expect, it } from "vitest";
import { toSnapshot } from "../../../room/model.js";
import { buildSessionFile, exportBytes } from "../../../room/sessionExport.js";
import { ALICE, BOB, DM, mixedHistoryFixture } from "./history.fixtures.js";

describe("drawing history snapshot and export baseline", () => {
  it.each([
    ["DM", true, DM],
    ["player with redo", false, ALICE],
    ["player without history", false, BOB],
    ["unknown recipient", false, "new-uid"],
    ["recipientless DM/fork", true, undefined],
  ] as const)("snapshot for %s exposes no raw stacks or capabilities before U2", (_, isDM, uid) => {
    const { state } = mixedHistoryFixture();
    const beforeUndo = structuredClone(state.drawingUndoStacks);
    const beforeRedo = structuredClone(state.drawingRedoStacks);

    const snapshot = toSnapshot(state, isDM, uid);

    expect(snapshot).not.toHaveProperty("drawingUndoStacks");
    expect(snapshot).not.toHaveProperty("drawingRedoStacks");
    expect(snapshot).not.toHaveProperty("drawingHistory");
    expect(snapshot.assets?.find((asset) => asset.type === "drawings")?.payload).toEqual(
      state.drawings,
    );
    expect(state.drawingUndoStacks).toEqual(beforeUndo);
    expect(state.drawingRedoStacks).toEqual(beforeRedo);
    // CHANGE only the capabilities expectation when U2 adds them. Retain
    // raw-stack absence and read-purity checks; recipientless stays omitted.
  });

  it("export bytes ignore runtime histories even for a DM who can actually Undo", () => {
    const { service, state } = mixedHistoryFixture();
    const withoutHistory = structuredClone(state);
    withoutHistory.drawingUndoStacks = {};
    withoutHistory.drawingRedoStacks = {};
    const proof = structuredClone(state);
    expect(proof.drawings.map(({ id }) => id)).toEqual(["dm-kept"]);
    expect(service.undoDrawing(proof, DM)).toBe(true);
    expect(proof.drawings).toEqual([]);
    expect(service.undoDrawing(structuredClone(withoutHistory), DM)).toBe(false);

    const withHistoryFile = buildSessionFile(state, [], DM, 1234);
    const withoutHistoryFile = buildSessionFile(withoutHistory, [], DM, 1234);

    expect(withHistoryFile.snapshot.drawings).toEqual(state.drawings);
    expect(withHistoryFile.snapshot).not.toHaveProperty("drawingHistory");
    expect(withHistoryFile.snapshot).not.toHaveProperty("drawingUndoStacks");
    expect(withHistoryFile.snapshot).not.toHaveProperty("drawingRedoStacks");
    expect(JSON.stringify(withHistoryFile)).toBe(JSON.stringify(withoutHistoryFile));
    expect(exportBytes(state, [], DM)).toBe(exportBytes(withoutHistory, [], DM));
    // REQUIRED after metadata exists: assert BEFORE export that
    // toSnapshot(state, true, DM).drawingHistory equals true/false and the
    // no-history state equals false/false. This catches the real-recipient
    // flattenForFile leak; a recipientless snapshot cannot prove stripping.
  });

  it("repeated recipient snapshot reads preserve history for a same-UID resync", () => {
    const { service, state } = mixedHistoryFixture();
    const historyBefore = structuredClone({
      undo: state.drawingUndoStacks,
      redo: state.drawingRedoStacks,
    });

    toSnapshot(state, true, DM);
    toSnapshot(state, false, ALICE);
    toSnapshot(state, false, "new-uid");
    toSnapshot(state, false, ALICE);

    expect(state.drawingUndoStacks).toEqual(historyBefore.undo);
    expect(state.drawingRedoStacks).toEqual(historyBefore.redo);
    expect(service.undoDrawing(state, "new-uid")).toBe(false);
    expect(service.redoDrawing(state, "new-uid")).toBe(false);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["dm-kept", "alice-undone"]);
    expect(service.undoDrawing(state, DM)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["alice-undone"]);
    // This tests the real snapshot projection, not network reconnect/auth.
  });
});
