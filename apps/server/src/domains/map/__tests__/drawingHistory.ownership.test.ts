import { describe, expect, it } from "vitest";
import type { Drawing } from "@herobyte/shared";
import { drawingHistoryFor } from "../drawingHistory.js";
import type { DrawingOperation } from "../types.js";
import {
  ALICE,
  BOB,
  DM,
  drawing,
  historyFixture,
  segment,
} from "./characterization/history.fixtures.js";

const owned = (id: string, owner: string, x = 0): Drawing => ({ ...drawing(id, x), owner });

describe("drawing history ownership and ID collisions", () => {
  it("does not reach another player's reused ID below a stale top operation", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("a"), ALICE);
    service.addDrawing(state, drawing("b"), ALICE);
    expect(service.deleteDrawing(state, "a", DM, true)).toBe(true);
    expect(service.deleteDrawing(state, "b", DM, true)).toBe(true);
    service.addDrawing(state, drawing("a", 200), BOB);
    const before = structuredClone(state);

    expect(drawingHistoryFor(state, ALICE)).toEqual({ canUndo: false, canRedo: false });
    expect(service.undoDrawing(state, ALICE)).toBe(false);
    expect(state.drawings).toEqual(before.drawings);
    expect(state.drawingUndoStacks).toEqual(before.drawingUndoStacks);
    expect(state.drawingRedoStacks).toEqual(before.drawingRedoStacks);
  });

  it.each(["add", "erase"] as const)("does not restore %s over an occupied ID", (type) => {
    const { service, state } = historyFixture();
    state.drawings = [owned("occupied", BOB, 200)];
    const operation: DrawingOperation = { type, drawing: owned("occupied", ALICE) };
    const source = type === "add" ? state.drawingRedoStacks : state.drawingUndoStacks;
    source[ALICE] = [operation];
    const before = structuredClone(state);

    expect(drawingHistoryFor(state, ALICE)).toEqual({ canUndo: false, canRedo: false });
    expect(
      type === "add" ? service.redoDrawing(state, ALICE) : service.undoDrawing(state, ALICE),
    ).toBe(false);
    expect(state.drawings).toEqual(before.drawings);
    expect(source[ALICE]).toEqual([operation]);
  });

  it("does not redo an erase against another owner's reused ID", () => {
    const { service, state } = historyFixture();
    const bobDrawing = owned("erased", BOB, 200);
    state.drawings = [bobDrawing];
    const operation: DrawingOperation = { type: "erase", drawing: owned("erased", ALICE) };
    state.drawingRedoStacks[ALICE] = [operation];

    expect(drawingHistoryFor(state, ALICE)).toEqual({ canUndo: false, canRedo: false });
    expect(service.redoDrawing(state, ALICE)).toBe(false);
    expect(state.drawings).toEqual([bobDrawing]);
    expect(state.drawingRedoStacks[ALICE]).toEqual([operation]);
  });

  it("removes the recorded owner when legacy duplicate IDs put another owner first", () => {
    const { service, state } = historyFixture();
    const bobDrawing = owned("erased", BOB, 200);
    const aliceDrawing = owned("erased", ALICE);
    state.drawings = [bobDrawing, aliceDrawing];
    state.drawingRedoStacks[ALICE] = [{ type: "erase", drawing: aliceDrawing }];

    expect(drawingHistoryFor(state, ALICE).canRedo).toBe(true);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([bobDrawing]);
  });

  it("Undo partial erase removes only recorded segment owners from legacy duplicates", () => {
    const { service, state } = historyFixture();
    const bobOriginal = owned("original", BOB, 200);
    const bobSegment = owned("segment", BOB, 300);
    const aliceSegment = owned("segment", ALICE, 10);
    state.drawings = [bobOriginal, bobSegment, aliceSegment];
    state.drawingUndoStacks[ALICE] = [
      { type: "partial-erase", original: owned("original", ALICE), segments: [aliceSegment] },
    ];

    expect(drawingHistoryFor(state, ALICE).canUndo).toBe(true);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([bobOriginal, bobSegment]);
  });

  it("Redo partial erase removes only the recorded original and preserves occupied segments", () => {
    const { service, state } = historyFixture();
    const bobOriginal = owned("original", BOB, 200);
    const aliceOriginal = owned("original", ALICE);
    const bobSegment = owned("occupied-segment", BOB, 300);
    const missingSegment = owned("missing-segment", ALICE, 15);
    state.drawings = [bobOriginal, aliceOriginal, bobSegment];
    state.drawingRedoStacks[ALICE] = [
      {
        type: "partial-erase",
        original: aliceOriginal,
        segments: [owned("occupied-segment", ALICE, 5), missingSegment],
      },
    ];

    expect(drawingHistoryFor(state, ALICE).canRedo).toBe(true);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([bobOriginal, bobSegment, missingSegment]);
  });

  it.each(["undo", "redo"] as const)(
    "%s partial erase is unavailable when every recorded ID belongs to another owner",
    (direction) => {
      const { service, state } = historyFixture();
      state.drawings = [owned("original", BOB, 200), owned("segment", BOB, 300)];
      const operation: DrawingOperation = {
        type: "partial-erase",
        original: owned("original", ALICE),
        segments: [owned("segment", ALICE, 10)],
      };
      const source = direction === "undo" ? state.drawingUndoStacks : state.drawingRedoStacks;
      source[ALICE] = [operation];
      const before = structuredClone(state.drawings);

      expect(drawingHistoryFor(state, ALICE)).toEqual({ canUndo: false, canRedo: false });
      expect(
        direction === "undo"
          ? service.undoDrawing(state, ALICE)
          : service.redoDrawing(state, ALICE),
      ).toBe(false);
      expect(state.drawings).toEqual(before);
      expect(source[ALICE]).toEqual([operation]);
    },
  );

  it("still undoes and redoes a real partial erase of an unowned legacy original", () => {
    const { service, state } = historyFixture();
    const original = drawing("unowned");
    state.drawings = [original];
    expect(service.handlePartialErase(state, original.id, [segment(10, 20)], ALICE)).toBe(true);
    const segments = structuredClone(state.drawings);
    expect(segments[0].owner).toBe(ALICE);

    expect(drawingHistoryFor(state, ALICE).canUndo).toBe(true);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual([original]);
    expect(drawingHistoryFor(state, ALICE).canRedo).toBe(true);
    expect(service.redoDrawing(state, ALICE)).toBe(true);
    expect(state.drawings).toEqual(segments);
  });

  it.each([ALICE, BOB])(
    "rejects a duplicate draw by %s without changing either history",
    (actor) => {
      const { service, state } = historyFixture();
      service.addDrawing(state, drawing("existing"), ALICE);
      service.addDrawing(state, drawing("undone"), actor);
      expect(service.undoDrawing(state, actor)).toBe(true);
      const before = structuredClone(state);

      service.addDrawing(state, drawing("existing", 200), actor);

      expect(state.drawings).toEqual(before.drawings);
      expect(state.drawingUndoStacks).toEqual(before.drawingUndoStacks);
      expect(state.drawingRedoStacks).toEqual(before.drawingRedoStacks);
    },
  );

  it("remaps sync collisions without dropping geometry or resetting another player's history", () => {
    const { service, state } = historyFixture();
    service.addDrawing(state, drawing("bob-kept", 200), BOB);
    service.addDrawing(state, drawing("bob-undone", 250), BOB);
    expect(service.undoDrawing(state, BOB)).toBe(true);
    service.addDrawing(state, drawing("alice-replaced"), ALICE);
    service.addDrawing(state, drawing("alice-undone", 50), ALICE);
    expect(service.undoDrawing(state, ALICE)).toBe(true);
    const bobBefore = structuredClone({
      drawings: state.drawings.filter(({ owner }) => owner === BOB),
      undo: state.drawingUndoStacks[BOB],
      redo: state.drawingRedoStacks[BOB],
    });
    const incoming = [" bob-kept ", "batch", "batch", "alice-replaced", ""].map((id, i) => ({
      ...owned(id, BOB, 1000 + i * 100),
      selectedBy: BOB,
    }));
    const incomingBefore = structuredClone(incoming);

    service.replacePlayerDrawings(state, ALICE, incoming);

    const imported = state.drawings.filter(({ owner }) => owner === ALICE);
    expect(imported).toHaveLength(incoming.length);
    expect(new Set(state.drawings.map(({ id }) => id)).size).toBe(state.drawings.length);
    expect(imported.every(({ id }) => id.trim().length > 0)).toBe(true);
    expect(imported.map(({ points }) => points)).toEqual(incoming.map(({ points }) => points));
    expect(imported.every(({ selectedBy }) => selectedBy === undefined)).toBe(true);
    expect(imported[0].id).not.toBe("bob-kept");
    expect(imported[1].id).toBe("batch");
    expect(imported[2].id).not.toBe("batch");
    expect(imported[3].id).toBe("alice-replaced");
    expect(state.drawings.filter(({ owner }) => owner === BOB)).toEqual(bobBefore.drawings);
    expect(state.drawingUndoStacks[BOB]).toEqual(bobBefore.undo);
    expect(state.drawingRedoStacks[BOB]).toEqual(bobBefore.redo);
    expect(state.drawingUndoStacks[ALICE]).toEqual([]);
    expect(state.drawingRedoStacks[ALICE]).toEqual([]);
    expect(incoming).toEqual(incomingBefore);
  });
});
