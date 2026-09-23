// Own-recipient drawing history and applicable-operation regression contract.
import { describe, expect, it } from "vitest";
import { toSnapshot } from "../../../room/model.js";
import { buildSessionFile, exportBytes } from "../../../room/sessionExport.js";
import { ALICE, BOB, DM, mixedHistoryFixture } from "./history.fixtures.js";

describe("drawing history recipient projection and export", () => {
  it.each([
    ["DM", true, DM, { canUndo: true, canRedo: false }],
    ["player with redo", false, ALICE, { canUndo: false, canRedo: true }],
    ["player without history", false, BOB, { canUndo: false, canRedo: false }],
    ["unknown recipient", false, "new-uid", { canUndo: false, canRedo: false }],
    ["recipientless DM/fork", true, undefined, undefined],
  ] as const)("snapshot for %s exposes only its own capability pair", (_, isDM, uid, expected) => {
    const { state } = mixedHistoryFixture();
    const beforeUndo = structuredClone(state.drawingUndoStacks);
    const beforeRedo = structuredClone(state.drawingRedoStacks);

    const snapshot = toSnapshot(state, isDM, uid);

    expect(snapshot).not.toHaveProperty("drawingUndoStacks");
    expect(snapshot).not.toHaveProperty("drawingRedoStacks");
    if (uid === undefined) expect(snapshot).not.toHaveProperty("drawingHistory");
    else {
      expect(snapshot.drawingHistory).toEqual(expected);
      expect(Object.keys(snapshot.drawingHistory!)).toEqual(["canUndo", "canRedo"]);
    }
    expect(snapshot.assets?.find((asset) => asset.type === "drawings")?.payload).toEqual(
      state.drawings,
    );
    expect(state.drawingUndoStacks).toEqual(beforeUndo);
    expect(state.drawingRedoStacks).toEqual(beforeRedo);
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

    expect(toSnapshot(state, true, DM).drawingHistory).toEqual({ canUndo: true, canRedo: false });
    expect(toSnapshot(withoutHistory, true, DM).drawingHistory).toEqual({
      canUndo: false,
      canRedo: false,
    });
    const withHistoryFile = buildSessionFile(state, [], DM, 1234);
    const withoutHistoryFile = buildSessionFile(withoutHistory, [], DM, 1234);

    expect(withHistoryFile.snapshot.drawings).toEqual(state.drawings);
    expect(withHistoryFile.snapshot).not.toHaveProperty("drawingHistory");
    expect(withHistoryFile.snapshot).not.toHaveProperty("drawingUndoStacks");
    expect(withHistoryFile.snapshot).not.toHaveProperty("drawingRedoStacks");
    expect(JSON.stringify(withHistoryFile)).toBe(JSON.stringify(withoutHistoryFile));
    expect(exportBytes(state, [], DM)).toBe(exportBytes(withoutHistory, [], DM));
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
