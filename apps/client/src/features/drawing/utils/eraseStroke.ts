// ============================================================================
// ERASE STROKE — what one eraser pass does to the drawings under it
// ============================================================================
// Lifted out of useDrawingTool unchanged (S6), because templates pushed that
// hook past the 350-LOC guard and this loop was never hook state to begin
// with: it reads a stroke, asks evaluatePartialErase what each drawing should
// become, and emits messages.

import type { ClientMessage, SceneObject } from "@herobyte/shared";
import { evaluatePartialErase } from "./partialErase";

/**
 * Emit the delete/partial-erase messages for one eraser stroke.
 *
 * Nothing is sent for a drawing the stroke missed, so a stray pass over empty
 * canvas costs no traffic.
 */
export function commitEraseStroke(
  drawingObjects: (SceneObject & { type: "drawing" })[],
  eraserPath: { x: number; y: number }[],
  eraserWidth: number,
  sendMessage: (message: ClientMessage) => void,
): void {
  for (const drawing of drawingObjects) {
    const drawingId = drawing.data.drawing.id;
    const result = evaluatePartialErase(drawing, eraserPath, eraserWidth);

    if (result.kind === "none") continue;

    if (result.kind === "partial") {
      sendMessage({ t: "erase-partial", deleteId: drawingId, segments: result.segments });
      continue;
    }

    sendMessage({ t: "delete-drawing", id: drawingId });
  }
}
