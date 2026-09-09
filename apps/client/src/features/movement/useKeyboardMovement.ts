// ============================================================================
// KEYBOARD MOVEMENT — the hook
// ============================================================================
// WASD / arrows / QEZC / numpad move the SELECTED objects one grid cell per
// press, over the same `transform-object` message a drag release sends — so
// the server's ownership, lock and wall checks apply unchanged, and the fog
// cone redraws from the next snapshot square by square.
//
// Guard, per invariant 4.17 (the G precedent) MINUS its DM-only clause — a
// player moving their own token is the point: not from a typing surface, no
// modifier, not a held key (`event.repeat`), and inert in map-edit mode,
// where the DM is authoring the map, not moving pieces on it.
//
// REPEAT MODEL (slice 1): discrete presses only. A held key at the OS repeat
// rate would be ~30 transform-object messages a second, each a broadcast and
// a fog re-filter per recipient; swallowing `repeat` keeps one press = one
// round trip. Fast discrete presses chain from the last SENT cell while the
// snapshot catches up (stepOrigin), so a press is never lost to latency.

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { isEditableTarget } from "../../utils/isEditableTarget";
import {
  deltaForKey,
  movableSelection,
  stepOrigin,
  type CellDelta,
  type PendingStep,
} from "./keyboardMovement";

export interface UseKeyboardMovementOptions {
  selectedObjectIds: readonly string[];
  snapshot: RoomSnapshot | null;
  uid: string;
  isDM: boolean;
  mapEditMode: boolean;
  sendMessage: (message: ClientMessage) => void;
}

/** What a layout needs to offer the same move without a keyboard (the phone d-pad). */
export interface MovementControls {
  /** How many selected objects this actor may move; 0 hides every affordance. */
  movableCount: number;
  /** Move every movable selected object by one cell. */
  move: (delta: CellDelta) => void;
}

export function useKeyboardMovement({
  selectedObjectIds,
  snapshot,
  uid,
  isDM,
  mapEditMode,
  sendMessage,
}: UseKeyboardMovementOptions): MovementControls {
  const movable = useMemo(
    () => movableSelection({ selectedObjectIds, snapshot, uid, isDM }),
    [selectedObjectIds, snapshot, uid, isDM],
  );
  const pendingRef = useRef(new Map<string, PendingStep>());

  const move = useCallback(
    ({ dx, dy }: CellDelta) => {
      const now = Date.now();
      for (const object of movable) {
        // A token spawned or dragged with Snap off sits on a fractional cell;
        // a keyboard step lands on WHOLE cells, so the origin snaps first.
        const from = { x: Math.round(object.x), y: Math.round(object.y) };
        const origin = stepOrigin(from, pendingRef.current.get(object.id), now);
        const to = { x: origin.x + dx, y: origin.y + dy };
        pendingRef.current.set(object.id, { from, to, at: now });
        sendMessage({ t: "transform-object", id: object.id, position: to });
      }
    },
    [movable, sendMessage],
  );

  useEffect(() => {
    if (mapEditMode || movable.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const delta = deltaForKey(event);
      if (!delta) return;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      move(delta);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapEditMode, movable.length, move]);

  return useMemo(() => ({ movableCount: movable.length, move }), [movable.length, move]);
}
