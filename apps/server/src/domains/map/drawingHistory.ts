import { coerceAreaTemplate } from "@herobyte/shared";
import type { Drawing } from "@herobyte/shared";
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

export function undoDrawing(state: RoomState, ownerUid: string): boolean {
  const undoStack = getUndoStack(state, ownerUid);
  const operation = undoStack.pop();
  if (!operation) {
    return false;
  }

  const applied = applyUndoOperation(state, ownerUid, operation);
  if (!applied) {
    undoStack.push(operation);
    return false;
  }

  getRedoStack(state, ownerUid).push(cloneOperation(operation));
  return true;
}

export function redoDrawing(state: RoomState, ownerUid: string): boolean {
  const redoStack = getRedoStack(state, ownerUid);
  const operation = redoStack.pop();
  if (!operation) {
    return false;
  }

  const applied = applyRedoOperation(state, ownerUid, operation);
  if (!applied) {
    redoStack.push(operation);
    return false;
  }

  const undoStack = getUndoStack(state, ownerUid);
  undoStack.push(cloneOperation(operation));
  return true;
}

function applyUndoOperation(
  state: RoomState,
  ownerUid: string,
  operation: DrawingOperation,
): boolean {
  switch (operation.type) {
    case "add":
      return removeDrawingById(state, operation.drawing.id);

    case "erase":
      restoreDrawing(state, operation.drawing);
      return true;

    case "partial-erase":
      removeSegmentDrawings(state, operation.segments);
      restoreDrawing(state, operation.original);
      return true;
  }
  return false;
}

function applyRedoOperation(
  state: RoomState,
  ownerUid: string,
  operation: DrawingOperation,
): boolean {
  switch (operation.type) {
    case "add":
      restoreDrawing(state, operation.drawing);
      return true;

    case "erase":
      return removeDrawingById(state, operation.drawing.id);

    case "partial-erase": {
      const removed = removeDrawingById(state, operation.original.id);
      // Even if original is already absent, continue applying segments
      for (const segment of operation.segments) {
        restoreDrawing(state, segment);
      }
      return removed || operation.segments.length > 0;
    }
  }
  return false;
}

function removeDrawingById(state: RoomState, drawingId: string): boolean {
  const index = state.drawings.findIndex((candidate) => candidate.id === drawingId);
  if (index === -1) {
    return false;
  }
  state.drawings.splice(index, 1);
  return true;
}

function restoreDrawing(state: RoomState, drawing: Drawing): void {
  const exists = state.drawings.some((candidate) => candidate.id === drawing.id);
  if (exists) {
    return;
  }
  state.drawings.push(cloneDrawing(drawing));
}

function removeSegmentDrawings(state: RoomState, segments: Drawing[]): void {
  const ids = new Set(segments.map((segment) => segment.id));
  if (ids.size === 0) {
    return;
  }
  state.drawings = state.drawings.filter((drawing) => !ids.has(drawing.id));
}
