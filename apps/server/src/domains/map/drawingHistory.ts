import { isDrawingLocked } from "../room/locking/pieceLock.js";
import { coerceAreaTemplate } from "@herobyte/shared";
import type { Drawing, DrawingHistoryCapabilities } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import type { DrawingOperation, DrawingOperationStack } from "./types.js";

function getUndoStack(state: RoomState, ownerUid: string): DrawingOperationStack {
  if (!state.drawingUndoStacks[ownerUid]) {
    state.drawingUndoStacks[ownerUid] = [];
  }
  return state.drawingUndoStacks[ownerUid]!;
}

function getRedoStack(state: RoomState, ownerUid: string): DrawingOperationStack {
  if (!state.drawingRedoStacks[ownerUid]) {
    state.drawingRedoStacks[ownerUid] = [];
  }
  return state.drawingRedoStacks[ownerUid]!;
}

function clearRedoStack(state: RoomState, ownerUid: string): void {
  const stack = getRedoStack(state, ownerUid);
  stack.length = 0;
}

export function cloneDrawing(drawing: Drawing): Drawing {
  const { selectedBy: _omitSelection, ...rest } = drawing;
  const clonedPoints = Array.isArray(drawing.points)
    ? drawing.points.map((point) => ({ x: point.x, y: point.y }))
    : [];
  // The template is re-derived through the whitelist rather than aliased:
  // the message validator only REJECTS a bad one, so without this the raw
  // object a client sent — extra keys and all — would be what gets stored,
  // broadcast and written to disk. A state file poisoned before S6's
  // validator existed is disarmed here too.
  const template = coerceAreaTemplate(drawing.template);
  return {
    ...rest,
    points: clonedPoints,
    ...(template ? { template } : { template: undefined }),
  };
}

function cloneOperation(operation: DrawingOperation): DrawingOperation {
  switch (operation.type) {
    case "add":
      return { type: "add", drawing: cloneDrawing(operation.drawing) };
    case "erase":
      return { type: "erase", drawing: cloneDrawing(operation.drawing) };
    case "partial-erase":
      return {
        type: "partial-erase",
        original: cloneDrawing(operation.original),
        segments: operation.segments.map((segment) => cloneDrawing(segment)),
      };
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
}

export function recordUserOperation(
  state: RoomState,
  ownerUid: string,
  operation: DrawingOperation,
): void {
  const undoStack = getUndoStack(state, ownerUid);
  undoStack.push(cloneOperation(operation));
  clearRedoStack(state, ownerUid);
}

export type Direction = "undo" | "redo";
type DrawingIndex = ReadonlyMap<string, ReadonlySet<Drawing["owner"]>>;

function indexDrawings(state: RoomState): DrawingIndex {
  const index = new Map<string, Set<Drawing["owner"]>>();
  for (const drawing of state.drawings) {
    const owners = index.get(drawing.id) ?? new Set<Drawing["owner"]>();
    owners.add(drawing.owner);
    index.set(drawing.id, owners);
  }
  return index;
}

function hasRecordedDrawing(index: DrawingIndex, drawing: Drawing): boolean {
  return index.get(drawing.id)?.has(drawing.owner) ?? false;
}

function applicable(
  index: DrawingIndex,
  operation: DrawingOperation,
  direction: Direction,
): boolean {
  switch (operation.type) {
    case "add":
      return direction === "undo"
        ? hasRecordedDrawing(index, operation.drawing)
        : !index.has(operation.drawing.id);
    case "erase":
      return direction === "undo"
        ? !index.has(operation.drawing.id)
        : hasRecordedDrawing(index, operation.drawing);
    case "partial-erase":
      return direction === "undo"
        ? !index.has(operation.original.id) ||
            operation.segments.some((part) => hasRecordedDrawing(index, part))
        : hasRecordedDrawing(index, operation.original) ||
            operation.segments.some((part) => !index.has(part.id));
  }
}

function nextApplicable(
  index: DrawingIndex,
  stack: DrawingOperationStack | undefined,
  direction: Direction,
): number {
  if (!Array.isArray(stack)) return -1;
  for (let position = stack.length - 1; position >= 0; position--) {
    if (applicable(index, stack[position]!, direction)) return position;
  }
  return -1;
}

/** A read only projection: no stack creation, pruning, cloning or transfer. */
export function drawingHistoryFor(state: RoomState, ownerUid: string): DrawingHistoryCapabilities {
  const index = indexDrawings(state);
  // A step that would remove a locked drawing is refused, so it is not offered either:
  // the button reads off until the DM unlocks it.
  return {
    canUndo:
      nextApplicable(index, state.drawingUndoStacks[ownerUid], "undo") !== -1 &&
      lockedDrawingsBlocking(state, ownerUid, "undo").length === 0,
    canRedo:
      nextApplicable(index, state.drawingRedoStacks[ownerUid], "redo") !== -1 &&
      lockedDrawingsBlocking(state, ownerUid, "redo").length === 0,
  };
}

/** The drawings an operation would REMOVE, in this direction. */
function removedBy(operation: DrawingOperation, direction: Direction): Drawing[] {
  switch (operation.type) {
    case "add":
      return direction === "undo" ? [operation.drawing] : [];
    case "erase":
      return direction === "undo" ? [] : [operation.drawing];
    case "partial-erase":
      return direction === "undo" ? operation.segments : [operation.original];
  }
}

/**
 * The locked drawings (scene ids) the next undo / redo would remove — a locked drawing
 * is deleted by no one, so that step is refused rather than skipped (skipping would
 * silently undo an older step instead). Empty when the step may run.
 */
export function lockedDrawingsBlocking(
  state: RoomState,
  ownerUid: string,
  direction: Direction,
): string[] {
  const stack =
    direction === "undo" ? state.drawingUndoStacks[ownerUid] : state.drawingRedoStacks[ownerUid];
  const index = nextApplicable(indexDrawings(state), stack, direction);
  if (index === -1) return [];
  return removedBy(stack![index]!, direction)
    .filter((drawing) => isDrawingLocked(state, drawing.id))
    .map((drawing) => `drawing:${drawing.id}`);
}

function execute(state: RoomState, ownerUid: string, direction: Direction): boolean {
  const stack =
    direction === "undo" ? state.drawingUndoStacks[ownerUid] : state.drawingRedoStacks[ownerUid];
  const index = nextApplicable(indexDrawings(state), stack, direction);
  if (index === -1) return false;
  const operation = stack![index]!;
  if (removedBy(operation, direction).some((drawing) => isDrawingLocked(state, drawing.id))) {
    return false;
  }
  const changed =
    direction === "undo"
      ? applyUndoOperation(state, operation)
      : applyRedoOperation(state, operation);
  if (!changed) return false;
  // Discard the selected item and stale entries above it ONLY. Lower operations
  // can become applicable after this one restores their original geometry.
  stack!.splice(index);
  const destination =
    direction === "undo" ? getRedoStack(state, ownerUid) : getUndoStack(state, ownerUid);
  destination.push(cloneOperation(operation));
  return true;
}

export function undoDrawing(state: RoomState, ownerUid: string): boolean {
  return execute(state, ownerUid, "undo");
}

export function redoDrawing(state: RoomState, ownerUid: string): boolean {
  return execute(state, ownerUid, "redo");
}

function applyUndoOperation(state: RoomState, operation: DrawingOperation): boolean {
  switch (operation.type) {
    case "add":
      return removeRecordedDrawing(state, operation.drawing);
    case "erase":
      return restoreDrawing(state, operation.drawing);
    case "partial-erase": {
      const removed = removeSegmentDrawings(state, operation.segments);
      const restored = restoreDrawing(state, operation.original);
      return removed || restored;
    }
  }
}

function applyRedoOperation(state: RoomState, operation: DrawingOperation): boolean {
  switch (operation.type) {
    case "add":
      return restoreDrawing(state, operation.drawing);
    case "erase":
      return removeRecordedDrawing(state, operation.drawing);
    case "partial-erase": {
      let changed = removeRecordedDrawing(state, operation.original);
      for (const segment of operation.segments) {
        // Do not short-circuit: each missing segment must be restored.
        const restored = restoreDrawing(state, segment);
        changed = restored || changed;
      }
      return changed;
    }
  }
}

function removeRecordedDrawing(state: RoomState, drawing: Drawing): boolean {
  // Old state can contain duplicate IDs, and a deleted ID can be reused by a
  // different player. History grants no authority over that player's drawing.
  const index = state.drawings.findIndex(
    (candidate) => candidate.id === drawing.id && candidate.owner === drawing.owner,
  );
  if (index === -1) return false;
  state.drawings.splice(index, 1);
  return true;
}

function restoreDrawing(state: RoomState, drawing: Drawing): boolean {
  if (state.drawings.some((candidate) => candidate.id === drawing.id)) return false;
  state.drawings.push(cloneDrawing(drawing));
  return true;
}

function removeSegmentDrawings(state: RoomState, segments: Drawing[]): boolean {
  let changed = false;
  for (const segment of segments) {
    const removed = removeRecordedDrawing(state, segment);
    changed = removed || changed;
  }
  return changed;
}
