// Own-recipient drawing history and applicable-operation regression contract.
import { describe, expect, it } from "vitest";
import type { DrawingOperation } from "../types.js";
import { toSnapshot } from "../../room/model.js";
import { ALICE, drawing, historyFixture } from "./characterization/history.fixtures.js";

type Case = {
  label: string;
  direction: "undo" | "redo";
  operation: DrawingOperation;
  present: string[];
  expected: string[];
  changes: boolean;
};
const a = { ...drawing("a"), owner: ALICE };
const b = { ...drawing("b"), owner: ALICE };
const c = { ...drawing("c"), owner: ALICE };
const add: DrawingOperation = { type: "add", drawing: a };
const erase: DrawingOperation = { type: "erase", drawing: a };
const partial: DrawingOperation = { type: "partial-erase", original: a, segments: [b, c] };
const empty: DrawingOperation = { type: "partial-erase", original: a, segments: [] };
const cases: Case[] = [
  {
    label: "Undo add present",
    direction: "undo",
    operation: add,
    present: ["a"],
    expected: [],
    changes: true,
  },
  {
    label: "Undo add missing",
    direction: "undo",
    operation: add,
    present: [],
    expected: [],
    changes: false,
  },
  {
    label: "Undo erase missing",
    direction: "undo",
    operation: erase,
    present: [],
    expected: ["a"],
    changes: true,
  },
  {
    label: "Undo erase already restored",
    direction: "undo",
    operation: erase,
    present: ["a"],
    expected: ["a"],
    changes: false,
  },
  {
    label: "Undo partial removes segments without duplicating original",
    direction: "undo",
    operation: partial,
    present: ["a", "b", "c"],
    expected: ["a"],
    changes: true,
  },
  {
    label: "Undo partial already undone",
    direction: "undo",
    operation: partial,
    present: ["a"],
    expected: ["a"],
    changes: false,
  },
  {
    label: "Undo partial restores missing original",
    direction: "undo",
    operation: partial,
    present: [],
    expected: ["a"],
    changes: true,
  },
  {
    label: "Redo add missing",
    direction: "redo",
    operation: add,
    present: [],
    expected: ["a"],
    changes: true,
  },
  {
    label: "Redo add already restored",
    direction: "redo",
    operation: add,
    present: ["a"],
    expected: ["a"],
    changes: false,
  },
  {
    label: "Redo erase present",
    direction: "redo",
    operation: erase,
    present: ["a"],
    expected: [],
    changes: true,
  },
  {
    label: "Redo erase already missing",
    direction: "redo",
    operation: erase,
    present: [],
    expected: [],
    changes: false,
  },
  {
    label: "Redo partial removes original without duplicating segments",
    direction: "redo",
    operation: partial,
    present: ["a", "b", "c"],
    expected: ["b", "c"],
    changes: true,
  },
  {
    label: "Redo partial already redone",
    direction: "redo",
    operation: partial,
    present: ["b", "c"],
    expected: ["b", "c"],
    changes: false,
  },
  {
    label: "Redo partial fills only missing segment",
    direction: "redo",
    operation: partial,
    present: ["b"],
    expected: ["b", "c"],
    changes: true,
  },
  {
    label: "Undo empty erase restores original",
    direction: "undo",
    operation: empty,
    present: [],
    expected: ["a"],
    changes: true,
  },
  {
    label: "Redo empty erase removes original",
    direction: "redo",
    operation: empty,
    present: ["a"],
    expected: [],
    changes: true,
  },
  {
    label: "Redo empty erase already done",
    direction: "redo",
    operation: empty,
    present: [],
    expected: [],
    changes: false,
  },
];

describe("drawing history geometry applicability", () => {
  it.each(cases)("$label", ({ direction, operation, present, expected, changes }) => {
    const { service, state } = historyFixture();
    state.drawings = present.map((id) => ({ ...drawing(id), owner: ALICE }));
    const source = direction === "undo" ? state.drawingUndoStacks : state.drawingRedoStacks;
    const destination = direction === "undo" ? state.drawingRedoStacks : state.drawingUndoStacks;
    source[ALICE] = [structuredClone(operation)];
    const before = structuredClone(source);

    expect(toSnapshot(state, false, ALICE).drawingHistory).toEqual({
      canUndo: direction === "undo" && changes,
      canRedo: direction === "redo" && changes,
    });
    expect(source).toEqual(before);
    const result =
      direction === "undo" ? service.undoDrawing(state, ALICE) : service.redoDrawing(state, ALICE);

    expect(result).toBe(changes);
    expect(state.drawings.map(({ id }) => id)).toEqual(expected);
    expect(new Set(state.drawings.map(({ id }) => id)).size).toBe(state.drawings.length);
    expect(source[ALICE]).toEqual(changes ? [] : before[ALICE]);
    expect(destination[ALICE] ?? []).toEqual(changes ? [operation] : []);
  });
});
