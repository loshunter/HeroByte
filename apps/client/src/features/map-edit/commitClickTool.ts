// Where a click tool's drop actually happens — place, scatter and light in one
// function rather than a chain of else-ifs inlined in the press handler.
//
// It became a module the moment there were TWO callers. A mouse drops on
// PRESS; a finger aims on press and drops on RELEASE (see useMapEditTouchAim
// for why). Left inline, the two paths would each carry their own copy of the
// three-way dispatch, and the failure that follows is the quiet kind: one path
// gains a fourth click tool and the other keeps silently doing nothing with it.

import type { MapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../map-studio/types";
import { placeLightAt } from "./lightPlacement";
import type { MapEditSubTool } from "./mapEditTypes";

/** The slice of useMapEditPlacement a drop needs — narrowed so a caller cannot
 * reach the cursor/ghost machinery from here by accident. */
export interface ClickToolPlacement {
  place: (point: { x: number; y: number }) => void;
  scatter: (point: { x: number; y: number }) => void;
}

export interface CommitClickToolOptions {
  subTool: MapEditSubTool;
  /** Undefined only when the controller is absent; light needs it, the others
   * reach it through `placement`, which was built with it. */
  controller: MapStudioController | undefined;
  /** Already checked to be the LIVE document by the caller. */
  document: MapDocument;
  point: { x: number; y: number };
  placement: ClickToolPlacement;
}

/**
 * Drop whatever the armed click tool drops, at `point`.
 *
 * No `saving` gate here: place and scatter self-gate inside
 * useMapEditPlacement (and raise onGestureDropped when they refuse), and light
 * goes through the controller's own queue. Adding a second gate here would
 * make a refused drop silent again, which is the bug that affordance exists to
 * prevent.
 */
export function commitClickTool({
  subTool,
  controller,
  document,
  point,
  placement,
}: CommitClickToolOptions): void {
  if (subTool === "light") {
    if (controller) placeLightAt(controller, document, point);
    return;
  }
  if (subTool === "scatter") {
    placement.scatter(point);
    return;
  }
  placement.place(point);
}
