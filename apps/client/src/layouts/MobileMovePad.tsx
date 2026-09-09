/**
 * The phone's stand-in for WASD: a 3×3 d-pad that moves the selection one
 * grid cell per tap, over the same `move` the desktop keys call. Lives inside
 * the selection sheet, so it exists exactly when something movable is
 * selected and never costs a dock slot (the dock is pinned at five).
 *
 * Press-and-HOLD walks, at the keyboard's cadence: one step on the press,
 * then one every HOLD_STEP_INTERVAL_MS after a short initial delay, until the
 * finger lifts or the gesture is cancelled (a finger sliding off a touch
 * target fires `pointercancel` — never `pointerleave` mid-press, which for a
 * touch pointer fires only AFTER `pointerup`, just before the compat `click`).
 *
 * One press = one step, on every kind of pointer. The `click` that follows a
 * pointer sequence carries `detail >= 1` and is ignored — the press already
 * stepped; a keyboard activation (Enter / Space) carries `detail === 0` and
 * steps once. Measured: a finger tap is down, up, out, leave, click; a mouse
 * click is down, up, click; a 900 ms press still ends in a click (detail 3).
 * A second finger on another button while a hold is active is ignored, so
 * two fingers can neither cut a walk short nor add a step.
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
// phone can take the same one-press diagonal step a keyboard can. In a short
// landscape viewport the CSS folds the pad to one row of the four
// orthogonals (`order` puts them ← ↑ ↓ →), since three rows do not fit.
const PAD: ReadonlyArray<{ label: string; name: string; delta: CellDelta; diagonal: boolean }> = [
  { label: "↖", name: "Move up-left", delta: { dx: -1, dy: -1 }, diagonal: true },
  { label: "↑", name: "Move up", delta: { dx: 0, dy: -1 }, diagonal: false },
  { label: "↗", name: "Move up-right", delta: { dx: 1, dy: -1 }, diagonal: true },
  { label: "←", name: "Move left", delta: { dx: -1, dy: 0 }, diagonal: false },
  { label: "·", name: "", delta: { dx: 0, dy: 0 }, diagonal: true },
  { label: "→", name: "Move right", delta: { dx: 1, dy: 0 }, diagonal: false },
  { label: "↙", name: "Move down-left", delta: { dx: -1, dy: 1 }, diagonal: true },
  { label: "↓", name: "Move down", delta: { dx: 0, dy: 1 }, diagonal: false },
  { label: "↘", name: "Move down-right", delta: { dx: 1, dy: 1 }, diagonal: true },
];

export function MobileMovePad({ movement }: MobileMovePadProps): JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The button whose hold is running, if any — only it may stop the walk. */
  const activeRef = useRef<string | null>(null);
  // Every snapshot during a walk replaces `movement.move` (it closes over the
  // current cells); the timer must call the LATEST one or a hold longer than
  // the chain's TTL would step from where the token was when the press began.
  const movementRef = useRef(movement);
  movementRef.current = movement;

  const stop = (name: string) => {
    if (activeRef.current !== name) return;
    activeRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  const startHold = (name: string, delta: CellDelta) => {
    if (activeRef.current !== null) return; // a second finger changes nothing
    activeRef.current = name;
    movement.move(delta);
    const walk = () => {
      movementRef.current.move(delta);
      timerRef.current = setTimeout(walk, HOLD_STEP_INTERVAL_MS);
    };
    timerRef.current = setTimeout(walk, HOLD_START_DELAY_MS);
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
            className={`mobile-chip mobile-move-pad__button${
              cell.diagonal ? " mobile-move-pad__button--diagonal" : ""
            }`}
            aria-label={cell.name}
            onPointerDown={() => startHold(cell.name, cell.delta)}
            onPointerUp={() => stop(cell.name)}
            onPointerCancel={() => stop(cell.name)}
            onClick={(event) => {
              if (event.detail === 0) movement.move(cell.delta);
            }}
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
