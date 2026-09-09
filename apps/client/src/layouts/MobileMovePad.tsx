/**
 * The phone's stand-in for WASD: a 3×3 d-pad that moves the selection one
 * grid cell per tap, over the same `move` the desktop keys call. Lives inside
 * the selection sheet, so it exists exactly when something movable is
 * selected and never costs a dock slot (the dock is pinned at five).
 *
 * Press-and-HOLD walks, at the keyboard's cadence: one step on the press,
 * then one every HOLD_STEP_INTERVAL_MS after a short initial delay, until the
 * finger lifts or leaves. A tap (pointerdown + pointerup + click) steps once —
 * the click that follows a pointer sequence is skipped; a keyboard activation
 * (Enter/Space, click with no pointer) still steps.
 */

import { useEffect, useRef } from "react";
import type { CellDelta } from "../features/movement/keyboardMovement";
import {
  HOLD_STEP_INTERVAL_MS,
  type MovementControls,
} from "../features/movement/useKeyboardMovement";

/** How long a press must be held before it starts walking. */
export const HOLD_START_DELAY_MS = 350;

interface MobileMovePadProps {
  movement: MovementControls;
}

// Reading order is screen order: top row is "up". Diagonals ride along so a
// phone can take the same one-press diagonal step a keyboard can.
const PAD: ReadonlyArray<{ label: string; name: string; delta: CellDelta }> = [
  { label: "↖", name: "Move up-left", delta: { dx: -1, dy: -1 } },
  { label: "↑", name: "Move up", delta: { dx: 0, dy: -1 } },
  { label: "↗", name: "Move up-right", delta: { dx: 1, dy: -1 } },
  { label: "←", name: "Move left", delta: { dx: -1, dy: 0 } },
  { label: "·", name: "", delta: { dx: 0, dy: 0 } },
  { label: "→", name: "Move right", delta: { dx: 1, dy: 0 } },
  { label: "↙", name: "Move down-left", delta: { dx: -1, dy: 1 } },
  { label: "↓", name: "Move down", delta: { dx: 0, dy: 1 } },
  { label: "↘", name: "Move down-right", delta: { dx: 1, dy: 1 } },
];

export function MobileMovePad({ movement }: MobileMovePadProps): JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStepped = useRef(false);
  // Every snapshot during a walk replaces `movement.move` (it closes over the
  // current cells); the timer must call the LATEST one or a hold longer than
  // the chain's TTL would step from where the token was when the press began.
  const movementRef = useRef(movement);
  movementRef.current = movement;

  const stop = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => stop, []);
  // A finger that slides off or is cancelled gets no click, so the "skip the
  // next click" latch must clear here or a later keyboard activation is eaten.
  const abandon = () => {
    stop();
    pointerStepped.current = false;
  };

  const startHold = (delta: CellDelta) => {
    stop();
    pointerStepped.current = true;
    movement.move(delta);
    const walk = () => {
      movementRef.current.move(delta);
      timerRef.current = setTimeout(walk, HOLD_STEP_INTERVAL_MS);
    };
    timerRef.current = setTimeout(walk, HOLD_START_DELAY_MS);
  };

  const onClick = (delta: CellDelta) => {
    if (pointerStepped.current) {
      pointerStepped.current = false;
      return;
    }
    movement.move(delta);
  };

  return (
    <div
      className="mobile-move-pad"
      role="group"
      aria-label="Move selection"
      onContextMenu={(event) => event.preventDefault()}
    >
      {PAD.map((cell) =>
        cell.name ? (
          <button
            key={cell.name}
            type="button"
            className="mobile-chip mobile-move-pad__button"
            aria-label={cell.name}
            onPointerDown={() => startHold(cell.delta)}
            onPointerUp={stop}
            onPointerCancel={abandon}
            onPointerLeave={abandon}
            onClick={() => onClick(cell.delta)}
          >
            {cell.label}
          </button>
        ) : (
          <span key="centre" className="mobile-move-pad__centre" aria-hidden="true">
            {cell.label}
          </span>
        ),
      )}
    </div>
  );
}
