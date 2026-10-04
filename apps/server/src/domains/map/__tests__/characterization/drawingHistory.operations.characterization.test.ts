// Own-recipient drawing history and applicable-operation regression contract.
import { describe, expect, it } from "vitest";
import { toSnapshot } from "../../../room/model.js";
import { ALICE, BOB, DM, drawing, historyFixture, segment } from "./history.fixtures.js";

describe("drawing history after applicability repair", () => {
  it("undoes to an empty canvas and redoes the same owned drawing", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    const original = structuredClone(state.drawings[0]);
    expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({
      canUndo: true,
      canRedo: false,
    });

    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
    expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({
      canUndo: false,
      canRedo: true,
    });
    expect(service.undoDrawing(state, ALICE)).toBe(false);
    expect(state.drawingUndoStacks[ALICE]).toEqual([]);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([original]);
    expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({
      canUndo: true,
      canRedo: false,
    });
    expect(service.redoDrawing(state, ALICE)).toBe(false);
    expect(state.drawingRedoStacks[ALICE]).toEqual([]);
  });

  it("keeps each player's history separate, including the DM's own history", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("alice"), ALICE);
    service.addDrawing(state, drawing("bob"), BOB);
    service.addDrawing(state, drawing("dm"), DM);

    expect(service.undoDrawing(state, DM)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["alice", "bob"]);
    expect(service.undoDrawing(state, DM)).toBe(false);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["bob"]);
    expect(service.redoDrawing(state, DM)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["bob", "dm"]);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
  });

  it("new work clears only its owner's redo and records a detached, unselected copy", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    service.addDrawing(state, drawing("b"), BOB);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(service.undoDrawing(state, BOB)).toBe(true);
    const submitted = { ...drawing("new"), owner: BOB, selectedBy: BOB };
    service.addDrawing(state, submitted, ALICE);
    submitted.points[0]!.x = 999;
    // Mutating live geometry must not rewrite the recorded copy either.
    state.drawings[0]!.points[1]!.x = 888;

    expect(service.redoDrawing(state, ALICE)).toBe(false);
    expect(state.drawingRedoStacks[BOB]).toHaveLength(1);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([{ ...drawing("new"), owner: ALICE }]);
    expect(state.drawings[0]).not.toHaveProperty("selectedBy");
  });

  it("replays a partial erase, its parent add, and both redos without losing dependencies", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("original"), ALICE);
    const original = structuredClone(state.drawings);
    expect(
      service.handlePartialErase(state, "original", [segment(0, 5), segment(15, 20)], ALICE),
    ).toBe(true);
    const split = structuredClone(state.drawings);
    expect(split).toHaveLength(2);
    expect(split.map(({ id }) => id)).not.toContain("original");

    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(original);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(original);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(split);
  });

  it("supports a nested partial erase of a generated segment across three undos and redos", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("original"), ALICE);
    const original = structuredClone(state.drawings);
    expect(
      service.handlePartialErase(state, "original", [segment(0, 8), segment(12, 20)], ALICE),
    ).toBe(true);
    const split = structuredClone(state.drawings);
    expect(service.handlePartialErase(state, split[0]!.id, [segment(0, 3)], ALICE)).toBe(true);
    const nested = structuredClone(state.drawings);
    const sorted = () => [...state.drawings].sort((a, b) => a.id.localeCompare(b.id));

    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(sorted()).toEqual([...split].sort((a, b) => a.id.localeCompare(b.id)));
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(original);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(original);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(split);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(nested);
  });

  it("treats an empty partial-erase batch as undoable, unlike deleteDrawing", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    expect(service.handlePartialErase(state, "a", [], ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings.map(({ id }) => id)).toEqual(["a"]);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
  });

  it("restores the full original after one replacement segment was independently deleted", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    expect(service.handlePartialErase(state, "a", [segment(0, 5), segment(15, 20)], ALICE)).toBe(
      true,
    );
    expect(service.deleteDrawing(state, state.drawings[0]!.id, DM, true)).toBe(true);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([{ ...drawing("a"), owner: ALICE }]);
  });

  it("skips a deleted newest add to undo the surviving lower drawing", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    service.addDrawing(state, drawing("b"), ALICE);
    expect(service.deleteDrawing(state, "b", ALICE)).toBe(true);

    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
    expect(state.drawingUndoStacks[ALICE]).toEqual([]);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([{ ...drawing("a"), owner: ALICE }]);
  });

  it("an already-restored add cannot report Redo success or transfer history", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    state.drawings.push({ ...drawing("a"), owner: ALICE });
    const before = structuredClone(state.drawings);
    const redo = structuredClone(state.drawingRedoStacks[ALICE]);

    expect(service.redoDrawing(state, ALICE)).toBe(false);
    expect(state.drawings).toEqual(before);
    expect(state.drawingUndoStacks[ALICE]).toEqual([]);
    expect(state.drawingRedoStacks[ALICE]).toEqual(redo);
  });
});
