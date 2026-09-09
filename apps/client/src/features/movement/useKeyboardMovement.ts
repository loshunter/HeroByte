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
// REPEAT MODEL (slice 2): a held key WALKS, at a bounded cadence. The OS
// repeat rate (~30/s) would be 30 transform-object broadcasts a second, each a
// fog re-filter per recipient; instead a repeat event steps only when
// HOLD_STEP_INTERVAL_MS has passed since the last step, so a hold is at most
// ~6 cells a second — still one press = one round trip, and chained from the
// last SENT cell while the snapshot catches up (stepOrigin), so no step is
// lost to latency. The first, non-repeat press is always immediate.

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

/** Minimum gap between steps while a key is HELD (a hold walks ~6 cells/s). */
export const HOLD_STEP_INTERVAL_MS = 150;

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
  const lastStepAtRef = useRef(0);

  const move = useCallback(
    ({ dx, dy }: CellDelta) => {
      const now = Date.now();
      lastStepAtRef.current = now;
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
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat && Date.now() - lastStepAtRef.current < HOLD_STEP_INTERVAL_MS) return;
      move(delta);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapEditMode, movable.length, move]);

  return useMemo(() => ({ movableCount: movable.length, move }), [movable.length, move]);
}
