/**
 * The phone's stand-in for WASD: a 3×3 d-pad that moves the selection one
 * grid cell per tap, over the same `move` the desktop keys call. Lives inside
 * the selection sheet, so it exists exactly when something movable is
 * selected and never costs a dock slot (the dock is pinned at five).
 *
 * Press-and-HOLD walks, at the keyboard's cadence: one step on the press,
 * then one every HOLD_STEP_INTERVAL_MS after an initial delay, until the
 * pointer is released or its capture is lost. The pointer is CAPTURED on the
 * press, so the release always comes home: a mouse (or pen) released off the
 * chip, a finger that slid off, a gesture the browser claims — every one of
 * them ends the walk. Where capture is refused (some pens; jsdom), the
 * pointer LEAVING the chip ends it instead, so no walk is ever unbounded.
 * (Measured: a finger that slides off a touch target still delivers
 * `pointerup` to it — implicit touch capture — and no compat click;
 * `pointercancel` fires only when the browser takes the gesture.) Only the
 * primary button of the primary pointer presses: a right-click is a menu,
 * not a step.
 *
 * One press = one step, on every kind of pointer. The `click` that follows a
 * pointer sequence carries `detail >= 1` and is ignored — the press already
 * stepped; a keyboard activation (Enter / Space) carries `detail === 0` and
 * steps once, throttled to the same cadence so a held Enter cannot outrun a
 * held key. Measured: a finger tap is down, up, out, leave, click; a mouse
 * click is down, up, click; a 900 ms press still ends in a click (detail 3).
 *
 * One hold at a time, keyed by POINTER id: a second finger — on the same
 * button or another — neither cuts the walk short nor adds a step.
 */

import { useEffect, useRef } from "react";
import type { CellDelta } from "../features/movement/keyboardMovement";
import {
  HOLD_STEP_INTERVAL_MS,
  type MovementControls,
} from "../features/movement/useKeyboardMovement";

/**
 * How long a press must be held before it starts walking. A deliberate tap
 * is ~100 ms and both platforms' long-press is 500 ms; at 350 a careful thumb
 * stepped twice and paid 10 ft for one press.
 */
export const HOLD_START_DELAY_MS = 500;

interface MobileMovePadProps {
  movement: MovementControls;
}

// Reading order is screen order: top row is "up". Diagonals ride along so a
// phone can take the same one-press diagonal step a keyboard can. In a short
// landscape viewport the CSS folds the pad to ONE row of eight — the
// orthogonals, then the diagonals — keyed on `data-dir`, never on the label
// text (the arc's review rejected a one-row fold that DROPPED the diagonals
// and made a landscape phone pay double for one; this one keeps them, and
// the 50px it saves is what lets a token and its plate fit above the sheet).
const PAD: ReadonlyArray<{
  label: string;
  name: string;
  dir: string;
  delta: CellDelta;
  diagonal: boolean;
}> = [
  { label: "↖", name: "Move up-left", dir: "up-left", delta: { dx: -1, dy: -1 }, diagonal: true },
  { label: "↑", name: "Move up", dir: "up", delta: { dx: 0, dy: -1 }, diagonal: false },
  { label: "↗", name: "Move up-right", dir: "up-right", delta: { dx: 1, dy: -1 }, diagonal: true },
  { label: "←", name: "Move left", dir: "left", delta: { dx: -1, dy: 0 }, diagonal: false },
  { label: "·", name: "", dir: "centre", delta: { dx: 0, dy: 0 }, diagonal: true },
  { label: "→", name: "Move right", dir: "right", delta: { dx: 1, dy: 0 }, diagonal: false },
  {
    label: "↙",
    name: "Move down-left",
    dir: "down-left",
    delta: { dx: -1, dy: 1 },
    diagonal: true,
  },
  { label: "↓", name: "Move down", dir: "down", delta: { dx: 0, dy: 1 }, diagonal: false },
  {
    label: "↘",
    name: "Move down-right",
    dir: "down-right",
    delta: { dx: 1, dy: 1 },
    diagonal: true,
  },
];

export function MobileMovePad({ movement }: MobileMovePadProps): JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The pointer whose hold is running, if any — only it may stop the walk. */
  const activePointerRef = useRef<number | null>(null);
  /** Whether the running hold's pointer was captured (else `pointerleave` ends it). */
  const capturedRef = useRef(false);
  /** Per BUTTON: a switch user moving focus ↑ → and activating within 150 ms gets both steps. */
  const lastKeyStepAtRef = useRef(new Map<string, number>());
  // `movement` is rebuilt when the movable count changes; the ref keeps a
  // running timer on the latest object (`move` itself is stable and sends
  // only a direction).
  const movementRef = useRef(movement);
  movementRef.current = movement;

  const stop = (pointerId: number) => {
    if (activePointerRef.current !== pointerId) return;
    activePointerRef.current = null;
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

  const startHold = (event: React.PointerEvent<HTMLButtonElement>, delta: CellDelta) => {
    if (event.button !== 0 || event.isPrimary === false) return; // a menu, not a press
    if (activePointerRef.current !== null) return; // a second finger changes nothing
    activePointerRef.current = event.pointerId;
    // A release off the chip (a mouse has no implicit capture) must still end
    // the walk: capture, so pointerup / lostpointercapture come to this button.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      capturedRef.current = true;
    } catch {
      // jsdom and some pens have no capture: pointerleave ends the walk instead.
      capturedRef.current = false;
    }
    movement.move(delta);
    const walk = () => {
      movementRef.current.move(delta);
      timerRef.current = setTimeout(walk, HOLD_STEP_INTERVAL_MS);
    };
    timerRef.current = setTimeout(walk, HOLD_START_DELAY_MS);
  };

  const keyboardStep = (dir: string, delta: CellDelta) => {
    const now = Date.now();
    if (now - (lastKeyStepAtRef.current.get(dir) ?? 0) < HOLD_STEP_INTERVAL_MS) return;
    lastKeyStepAtRef.current.set(dir, now);
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
            className={`mobile-chip mobile-move-pad__button${
              cell.diagonal ? " mobile-move-pad__button--diagonal" : ""
            }`}
            data-dir={cell.dir}
            aria-label={cell.name}
            onPointerDown={(event) => startHold(event, cell.delta)}
            onPointerUp={(event) => stop(event.pointerId)}
            onPointerCancel={(event) => stop(event.pointerId)}
            onLostPointerCapture={(event) => stop(event.pointerId)}
            onPointerLeave={(event) => {
              if (!capturedRef.current) stop(event.pointerId);
            }}
            onClick={(event) => {
              if (event.detail === 0) keyboardStep(cell.dir, cell.delta);
            }}
          >
            {cell.label}
          </button>
        ) : (
          <span
            key="centre"
            className="mobile-move-pad__centre"
            data-dir="centre"
            aria-hidden="true"
          >
            {cell.label}
          </span>
        ),
      )}
    </div>
  );
}
