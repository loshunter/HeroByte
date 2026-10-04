// Own-recipient drawing history and applicable-operation regression contract.
import { describe, expect, it } from "vitest";
import { toSnapshot } from "../../room/model.js";
import {
  ALICE,
  DM,
  drawing,
  historyFixture,
  segment,
} from "./characterization/history.fixtures.js";

const capabilities = (state: ReturnType<typeof historyFixture>["state"]) =>
  toSnapshot(state, false, ALICE).drawingHistory;

describe("drawing history next applicable operation", () => {
  it("reads past stale top Undo entries without mutation, then drops only those above the executed entry", () => {
    const { service, state } = historyFixture();
    for (const id of ["a", "b", "c"]) service.addDrawing(state, drawing(id), ALICE);
    expect(service.deleteDrawing(state, "b", DM, true)).toBe(true);
    expect(service.deleteDrawing(state, "c", DM, true)).toBe(true);
    const before = structuredClone(state.drawingUndoStacks);
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: false });
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: false });
    expect(state.drawingUndoStacks).toEqual(before);

    expect(service.undoDrawing(state, ALICE)).toBe(true);

    expect(state.drawings).toEqual([]);
    expect(state.drawingUndoStacks[ALICE]).toEqual([]);
    expect(state.drawingRedoStacks[ALICE]).toEqual([before[ALICE]![0]]);
    expect(capabilities(state)).toEqual({ canUndo: false, canRedo: true });
    expect(service.undoDrawing(state, ALICE)).toBe(false);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["a"]);
  });

  it("skips an already restored top Redo and performs one lower real change", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    service.addDrawing(state, drawing("b"), ALICE);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    state.drawings.push({ ...drawing("a"), owner: ALICE });
    const before = structuredClone(state.drawingRedoStacks);
    expect(capabilities(state)).toEqual({ canUndo: false, canRedo: true });
    expect(state.drawingRedoStacks).toEqual(before);

    expect(service.redoDrawing(state, ALICE)).toBe(true);

    expect(state.drawings.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(state.drawingRedoStacks[ALICE]).toEqual([]);
    expect(state.drawingUndoStacks[ALICE]).toEqual([before[ALICE]![0]]);
  });

  it("retains an inapplicable LOWER Redo that a later hard delete makes applicable", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    service.addDrawing(state, drawing("b"), ALICE);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    // Stack is [redo b, redo a]; b is currently inapplicable BELOW applicable a.
    state.drawings.push({ ...drawing("b"), owner: ALICE });
    const lower = structuredClone(state.drawingRedoStacks[ALICE]![0]);
    expect(capabilities(state)).toEqual({ canUndo: false, canRedo: true });
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawingRedoStacks[ALICE]).toEqual([lower]);
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: false });
    expect(service.deleteDrawing(state, "b", DM, true)).toBe(true);
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: true });
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("preserves dependent lower operations through nested partial erase, two Undos and two Redos", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("original"), ALICE);
    const original = structuredClone(state.drawings);
    expect(
      service.handlePartialErase(state, "original", [segment(0, 8), segment(12, 20)], ALICE),
    ).toBe(true);
    const split = structuredClone(state.drawings);
    expect(service.handlePartialErase(state, split[0]!.id, [segment(0, 3)], ALICE)).toBe(true);
    const nested = structuredClone(state.drawings);
    const before = structuredClone(state.drawingUndoStacks);
    const sorted = () => [...state.drawings].sort((a, b) => a.id.localeCompare(b.id));
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: false });
    expect(state.drawingUndoStacks).toEqual(before);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(sorted()).toEqual([...split].sort((a, b) => a.id.localeCompare(b.id)));
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: true });
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(original);
    expect(state.drawingUndoStacks[ALICE]).toHaveLength(1);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(2);
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: true });
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(split);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: true });
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(nested);
    expect(state.drawingUndoStacks[ALICE]).toHaveLength(3);
    expect(capabilities(state)).toEqual({ canUndo: true, canRedo: false });
  });
});
