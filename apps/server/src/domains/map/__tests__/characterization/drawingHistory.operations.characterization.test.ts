// DRAFT ONLY. Relative imports target domains/map/__tests__/characterization/.
import { describe, expect, it } from "vitest";
import { ALICE, BOB, DM, drawing, historyFixture, segment } from "./history.fixtures.js";

describe("drawing history before extraction", () => {
  it("undoes to an empty canvas and redoes the same owned drawing", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    const original = structuredClone(state.drawings[0]);

    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([]);
    expect(service.undoDrawing(state, ALICE)).toBe(false);
    expect(state.drawingUndoStacks[ALICE]).toEqual([]);
    expect(state.drawingRedoStacks[ALICE]).toHaveLength(1);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([original]);
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

  it("BASELINE BUG: deleting the newest drawing leaves a stale add blocking valid lower Undo", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    service.addDrawing(state, drawing("b"), ALICE);
    expect(service.deleteDrawing(state, "b", ALICE)).toBe(true);
    const history = structuredClone(state.drawingUndoStacks[ALICE]);

    expect(service.undoDrawing(state, ALICE)).toBe(false);
    expect(service.undoDrawing(state, ALICE)).toBe(false);
    expect(state.drawings.map(({ id }) => id)).toEqual(["a"]);
    expect(state.drawingUndoStacks[ALICE]).toEqual(history);
    expect(state.drawingRedoStacks[ALICE]).toEqual([]);
    // REPLACE in the repair: one Undo removes a, discards only stale b above
    // it, and makes a redoable. This baseline must not freeze the defect.
  });

  it("BASELINE BUG: an already-restored add reports Redo success without changing geometry", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    // A domain-boundary state fixture: redo's recorded ID already exists.
    // Using addDrawing would intentionally clear redo before this condition.
    state.drawings.push({ ...drawing("a"), owner: ALICE });
    const before = structuredClone(state.drawings);

    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(before);
    expect(state.drawingUndoStacks[ALICE]).toHaveLength(1);
    expect(state.drawingRedoStacks[ALICE]).toEqual([]);
    // REPLACE in the repair: false with no applicable redo; do not advertise
    // a change merely because a stack entry exists.
  });
});
