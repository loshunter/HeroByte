// ============================================================================
// AIMING A CLICK TOOL WITH A FINGER
// ============================================================================
// M7. Place, Scatter and Light are the last map-edit tools a phone could not
// reach, and the reason was never the input plumbing — M6 closed the
// compat-mouse doubling that used to drop two stamps per tap. The reason is
// AIMING: all three are aimed by a ghost that follows the mouse, and a finger
// produces no hover. A tap would be a blind drop, and blind is worst exactly
// where it matters most — scatter flings a seeded cluster whose shape derives
// from the point, so "roughly there" is not a thing a DM can want.
//
// So the finger gets a different gesture from the mouse, and this is the one
// place that difference lives:
//
//   mouse  press -> DROP
//   finger press -> AIM (the ghost appears under the finger)
//          move  -> re-aim, the ghost follows
//          lift  -> DROP at the aimed point
//
// That is the same "lifting your finger commits" contract every other touch
// tool in the app already teaches, so it needs no new idea in the guide — and
// it means ⨯ ABORT and the second-finger pinch both cancel a drop the same way
// they cancel a half-built room. A press-to-drop tap would have had nothing to
// abort.
//
// The aimed point is a REF, not state. It is written and read inside the same
// event tick Konva dispatches, and a re-render between touchstart and touchend
// would drop it. `cursor` inside useMapEditPlacement is the state that drives
// the ghost; this is the value the commit uses, and the two are set together.
//
// @module features/map-edit/useMapEditTouchAim

import { useCallback, useRef } from "react";

export interface UseMapEditTouchAimOptions {
  /** Map-edit is on AND a click sub-tool is armed. */
  active: boolean;
  /** Show (or hide, with null) the ghost at this document-space point. */
  updateCursor: (point: { x: number; y: number } | null) => void;
  /** Drop at a document-space point. Called once, on release. */
  commit: (point: { x: number; y: number }) => void;
}

export interface MapEditTouchAim {
  /** Touch-down: aim, do not drop. */
  start: (point: { x: number; y: number } | null) => void;
  /** Touch-move: re-aim. */
  move: (point: { x: number; y: number } | null) => void;
  /** Release: drop at the aimed point, if there is one. */
  commit: () => void;
  /** Second finger, ABORT, or the OS taking the gesture: aim at nothing. */
  cancel: () => void;
}

export function useMapEditTouchAim({
  active,
  updateCursor,
  commit,
}: UseMapEditTouchAimOptions): MapEditTouchAim {
  const aimed = useRef<{ x: number; y: number } | null>(null);

  const aim = useCallback(
    (point: { x: number; y: number } | null) => {
      if (!active) return;
      // A move that lands off the document reports null. Keep the LAST good
      // point rather than clearing it: a finger sliding past the edge and back
      // is one gesture, and forgetting mid-slide would make the release do
      // nothing for a reason the DM never saw.
      if (point) aimed.current = point;
      updateCursor(point ?? aimed.current);
    },
    [active, updateCursor],
  );

  const cancel = useCallback(() => {
    aimed.current = null;
    updateCursor(null);
  }, [updateCursor]);

  const release = useCallback(() => {
    const point = aimed.current;
    aimed.current = null;
    // The ghost goes whether or not anything was dropped — it tracks the
    // finger, and there is no finger now.
    updateCursor(null);
    if (active && point) commit(point);
  }, [active, updateCursor, commit]);

  return { start: aim, move: aim, commit: release, cancel };
}
