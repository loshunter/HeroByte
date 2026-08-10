// ============================================================================
// ABANDONING A MAP-EDIT GESTURE
// ============================================================================
// Every way an in-flight gesture ends WITHOUT being committed, in one place,
// because M4c added a second way and the two must agree about what "abandon"
// means: a drag loses its preview AND an accumulating terrain stroke is thrown
// away rather than painted.
//
// Why a SIGNAL and not a callback prop. The control that cancels lives in the
// mobile dock, which is MapBoard's SIBLING, not its ancestor — there is no
// callback to pass downward. A monotonically increasing counter crossing that
// boundary is the same shape `cameraCommand` already uses, and it survives the
// one case that matters: cancelling while the finger is still down. Clearing
// the drag ref mid-gesture makes the eventual release commit nothing, because
// every commit path re-reads the ref rather than the painted value.
//
// Escape stays DRAG-ONLY, deliberately. Widening it to brush strokes would
// change desktop behaviour that nothing here is trying to change: today
// Escape mid-stroke falls through to the global Escape-clears-tool listener,
// which leaves map-edit and flushes the stroke on the way out.

import { useEffect, useRef, type MutableRefObject } from "react";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";

interface UseMapEditCancelOptions {
  /** The tool is armed (map-edit mode with a sub-tool that takes the pointer). */
  active: boolean;
  /** Bumped by a control outside the canvas to abandon the gesture in flight. */
  cancelSignal: number | undefined;
  /** The live drag, or null between gestures. */
  currentDrag: () => RoomDrag | null;
  /** Abandon the drag and its pending frame. */
  clearDrag: () => void;
  /** True while a terrain/erase stroke is accumulating. */
  brushingRef: MutableRefObject<boolean>;
  /** Throw an accumulating stroke away without painting it. */
  discardStroke: () => void;
}

/** @returns cancelGesture — abandon whatever gesture is in flight, if any. */
export function useMapEditCancel({
  active,
  cancelSignal,
  currentDrag,
  clearDrag,
  brushingRef,
  discardStroke,
}: UseMapEditCancelOptions): () => void {
  // Not a useCallback: the ref and the two callbacks it closes over are all
  // identity-stable, and the latest-ref effect below reads it through a ref
  // anyway, so memoizing would buy nothing and hide the dependency.
  const cancelGesture = () => {
    clearDrag();
    if (brushingRef.current) {
      brushingRef.current = false;
      discardStroke();
    }
  };
  const cancelRef = useRef(cancelGesture);
  cancelRef.current = cancelGesture;

  // Escape cancels an in-progress drag WITHOUT clearing the tool: capture-phase
  // + stopImmediatePropagation preempts the global Escape-clears-tool listener.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && currentDrag()) {
        event.stopImmediatePropagation();
        event.preventDefault();
        clearDrag();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [active, currentDrag, clearDrag]);

  // The dep array is what makes this fire only on a change; `seen` seeds from
  // the first render so MOUNTING with an already-bumped signal is not itself a
  // cancel. That one line is hygiene rather than a fix — nothing can be in
  // flight at mount, so removing it is measurably invisible — but an effect
  // that "cancels" on every mount is a lie the next reader would trip over.
  const seen = useRef(cancelSignal);
  useEffect(() => {
    if (seen.current === cancelSignal) return;
    seen.current = cancelSignal;
    cancelRef.current();
  }, [cancelSignal]);

  return cancelGesture;
}
