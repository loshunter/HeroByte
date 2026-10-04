// Own-recipient drawing history and applicable-operation regression contract.
import { createMapDocument } from "@herobyte/shared";
import { describe, expect, it } from "vitest";
import { captureSceneState, restoreCollections } from "../../../room/scene/sceneSuspend.js";
import { buildSessionFile } from "../../../room/sessionExport.js";
import { toSnapshot } from "../../../room/model.js";
import { SnapshotLoader } from "../../../room/snapshot/SnapshotLoader.js";
import { StagingZoneManager } from "../../../room/staging/StagingZoneManager.js";
import { ALICE, DM, drawing, mixedHistoryFixture } from "./history.fixtures.js";

function expectMixedHistory(state: ReturnType<typeof mixedHistoryFixture>["state"]) {
  expect(state.drawingUndoStacks[DM]).toHaveLength(1);
  expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
  expect(state.drawings.map(({ id }) => id)).toEqual(["dm-kept"]);
  expect(toSnapshot(state, true, DM).drawingHistory).toEqual({ canUndo: true, canRedo: false });
  expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({ canUndo: false, canRedo: true });
}

describe("drawing history reset boundary capabilities", () => {
  it("Clear All discards every owner's undo and redo, even on the now-empty canvas", () => {
    const { service, state } = mixedHistoryFixture();
    expectMixedHistory(state);

    service.clearDrawings(state);

    expect(state.drawings).toEqual([]);
    expect(state.drawingUndoStacks).toEqual({});
    expect(state.drawingRedoStacks).toEqual({});
    for (const uid of [DM, ALICE]) {
      expect(toSnapshot(state, uid === DM, uid).drawingHistory).toEqual({
        canUndo: false,
        canRedo: false,
      });
    }
    expect(service.undoDrawing(state, DM)).toBe(false);
    expect(service.redoDrawing(state, ALICE)).toBe(false);
  });

  it.each([ALICE, DM])("import resets only %s and does not add import Undo", (owner) => {
    const { service, state } = mixedHistoryFixture();
    expectMixedHistory(state);
    const other = owner === ALICE ? DM : ALICE;
    const otherUndo = structuredClone(state.drawingUndoStacks[other]);
    const otherRedo = structuredClone(state.drawingRedoStacks[other]);
    const imported = { ...drawing(" imported "), owner: other, selectedBy: other };

    service.replacePlayerDrawings(state, owner, [imported]);

    expect(state.drawings.filter((entry) => entry.owner === owner)).toEqual([
      { ...drawing("imported"), owner },
    ]);
    expect(state.drawingUndoStacks[owner]).toEqual([]);
    expect(state.drawingRedoStacks[owner]).toEqual([]);
    expect(state.drawingUndoStacks[other]).toEqual(otherUndo);
    expect(state.drawingRedoStacks[other]).toEqual(otherRedo);
    expect(toSnapshot(state, owner === DM, owner).drawingHistory).toEqual({
      canUndo: false,
      canRedo: false,
    });
    expect(toSnapshot(state, other === DM, other).drawingHistory).toEqual({
      canUndo: other === DM,
      canRedo: other === ALICE,
    });
    expect(service.undoDrawing(state, owner)).toBe(false);
    expect(service.redoDrawing(state, owner)).toBe(false);
    expect(
      owner === ALICE ? service.undoDrawing(state, DM) : service.redoDrawing(state, ALICE),
    ).toBe(true);
  });

  it.each([false, true])("scene restore clears both stacks (saved scene: %s)", (savedScene) => {
    const { service, state } = mixedHistoryFixture();
    expectMixedHistory(state);
    const document = createMapDocument({ id: "history-scene", name: "History", timestamp: 1 });
    const { saved } = captureSceneState(state, document, 2);
    expect(saved.drawings.map(({ id }) => id)).toEqual(["dm-kept"]);
    expect(saved).not.toHaveProperty("drawingUndoStacks");
    expect(saved).not.toHaveProperty("drawingRedoStacks");
    expect(saved).not.toHaveProperty("drawingHistory");
    service.addDrawing(state, drawing("outgoing-after-capture"), DM);
    expect(saved.drawings).toHaveLength(1);

    restoreCollections(state, savedScene ? saved : undefined, [], { firstVisitFogEnabled: false });

    expect(state.drawings.map(({ id }) => id)).toEqual(savedScene ? ["dm-kept"] : []);
    expect(state.drawingUndoStacks).toEqual({});
    expect(state.drawingRedoStacks).toEqual({});
    for (const uid of [DM, ALICE]) {
      expect(toSnapshot(state, uid === DM, uid).drawingHistory).toEqual({
        canUndo: false,
        canRedo: false,
      });
    }
    expect(service.undoDrawing(state, DM)).toBe(false);
    expect(service.redoDrawing(state, ALICE)).toBe(false);
  });

  it("session load ignores supplied history and clears both old runtime stacks", () => {
    const { service, state } = mixedHistoryFixture();
    expectMixedHistory(state);
    const snapshot = {
      ...buildSessionFile(state, [], DM, 100).snapshot,
      // An edited input file may contain future metadata or raw old stacks.
      // The loader's whitelist, not the caller's TypeScript type, must win.
      drawingHistory: { canUndo: true, canRedo: true },
      drawingUndoStacks: structuredClone(state.drawingUndoStacks),
      drawingRedoStacks: structuredClone(state.drawingRedoStacks),
    };

    const loaded = new SnapshotLoader().mergeSnapshot(
      snapshot,
      state,
      new StagingZoneManager(state),
    );

    expect(loaded.drawings).toEqual(state.drawings);
    expect(loaded.drawingUndoStacks).toEqual({});
    expect(loaded.drawingRedoStacks).toEqual({});
    expect(loaded).not.toHaveProperty("drawingHistory");
    for (const uid of [DM, ALICE]) {
      expect(toSnapshot(loaded, uid === DM, uid).drawingHistory).toEqual({
        canUndo: false,
        canRedo: false,
      });
    }
    expect(service.undoDrawing(loaded, DM)).toBe(false);
    expect(service.redoDrawing(loaded, ALICE)).toBe(false);
  });
});
