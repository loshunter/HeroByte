// ============================================================================
// COLOUR PICKER — choose your character's colour (personal colour, C1)
// ============================================================================
// A hue × lightness window (hue wraps left to right, light at the top). Other
// players' colours hold zones, drawn darkened; dragging into one stops the
// handle at its edge, and a tap in one names whose it is. Three suggested spots mark the most open colours: one
// tap lands there, which is the whole job on a phone. A drag commits on
// release (one message), arrow keys commit once the keys go quiet, the preview
// follows the handle, and the server has the last word: a stale picker
// (someone joined) is snapped, and the sender is told. The DM's picker has no
// zones (the DM is exempt).

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  COLOR_WINDOW,
  colorToOkLab,
  normalizeColor,
  windowLightness,
  type WindowCell,
} from "@herobyte/shared";
import {
  cellOf,
  pickerField,
  placeHandle,
  pointAt,
  sameColor,
  stepPoint,
  zoneOwnerAt,
} from "./colorPickerModel";
import { pickerFieldKey, type ColorPickerControl } from "./colorPickerControl";
import { drawColorWindow } from "./drawColorWindow";
import { ColorPickerMarks, at } from "./ColorPickerMarks";
import { ColorPickerPreview } from "./ColorPickerPreview";
import "./colorPicker.css";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Arrow-key steps commit once the keys have been quiet this long (one message, not ten). */
export const KEY_COMMIT_MS = 400;
/** A commit the server answers without changing the colour stops showing after this. */
export const PENDING_TIMEOUT_MS = 1500;
/** A press that moves less than this is a tap, not a drag: a finger jitters more than a mouse. */
const TAP_SLOP_PX: Record<string, number> = { mouse: 3, pen: 6, touch: 10 };
/** A bump notice stays this long after the pointer lifts (on a phone, that is the label). */
export const NOTICE_HOLD_MS = 3000;
/** The window's drawn aspect (colorPicker.css), for the edge-stop before it is measured. */
const DRAWN_ASPECT = 2.6;

/** The line under the window: a bump or tap notice is announced, a hover label is not. */
interface Notice {
  text: string;
  live: boolean;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** How far it must move to be a drag rather than a tap, for this kind of pointer. */
  slop: number;
  /** Pressed on the handle itself: moves keep the grab offset, and a tap is no pick. */
  onHandle: boolean;
  /** Pressed inside another player's zone (whose): a tap there names it, a drag bumps. */
  zoneOwner: string | null;
  /** The cell a press on a free spot showed: a tap commits it, wherever the finger lifts. */
  pressed: WindowCell | null;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

export function ColorPicker(control: ColorPickerControl): JSX.Element {
  const fieldKey = pickerFieldKey(control);
  // Keyed, not on `control`: the holders arrive as a new array every snapshot.
  const field = useMemo(() => pickerField(control), [fieldKey]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<WindowCell | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const drag = useRef<Drag | null>(null);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyed = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef<string | null>(null);
  const aspect = useRef(DRAWN_ASPECT);
  const pendingRef = useRef<WindowCell | null>(null);
  pendingRef.current = pending;

  const stopTimer = (timer: { current: ReturnType<typeof setTimeout> | null }) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => drawColorWindow(canvasRef.current, field), [field]);
  // The server's answer to OUR pick (the colour we sent arrived) retires the
  // pending one; so does anyone else's change while nothing of ours is in flight.
  // Never under a drag or keys still choosing: an answer must not pull the handle
  // back from them. A snapped answer differs from what we sent: the pending timer
  // retires it a moment later, beside the toast.
  useEffect(() => {
    if (lastSent.current !== null && sameColor(control.color, lastSent.current)) {
      lastSent.current = null;
    }
    if (lastSent.current !== null || drag.current || keyed.current) return;
    stopTimer(pendingTimer);
    setPending(null);
  }, [control.color]);
  // Closing the window mid-keystroke still sends the colour the keys chose.
  const commitRef = useRef<(cell: WindowCell | null) => void>(() => {});
  useEffect(
    () => () => {
      stopTimer(pendingTimer);
      stopTimer(noticeTimer);
      if (keyed.current) commitRef.current(pendingRef.current);
    },
    [],
  );

  const committedCell = cellOf(control.color);
  const shown = pending ?? committedCell;
  const shownHex = pending?.hex ?? normalizeColor(control.color) ?? control.color;
  const shownLightness = colorToOkLab(shownHex)?.L;

  /** A notice that stays a few seconds after the pointer lifts (a tap shows it on a phone). */
  const holdNotice = () => {
    stopTimer(noticeTimer);
    noticeTimer.current = setTimeout(() => {
      noticeTimer.current = null; // A mouse's hover labels come back.
      setNotice(null);
    }, NOTICE_HOLD_MS);
  };
  const moveTo = (point: { u: number; v: number }) => {
    // The person is choosing again: an earlier pick's timeout must not erase this one.
    stopTimer(pendingTimer);
    stopTimer(noticeTimer);
    const placed = placeHandle(point, field, control.exempt, aspect.current);
    setPending(placed.cell);
    setNotice(placed.blockedBy ? { text: `Too close to ${placed.blockedBy}`, live: true } : null);
    return placed.cell;
  };
  const commit = (cell: WindowCell | null) => {
    stopTimer(keyTimer);
    keyed.current = false;
    // Judged against a pick still in flight: going back to the old colour is a pick too.
    if (!cell || sameColor(cell.hex, lastSent.current ?? control.color)) {
      if (lastSent.current === null) setPending(null);
      return;
    }
    lastSent.current = cell.hex;
    control.onCommit(cell.hex);
    // An answer that leaves the colour as it was (a snap back) changes nothing to
    // clear the pending one on; it stops showing after a moment instead.
    stopTimer(pendingTimer);
    pendingTimer.current = setTimeout(() => {
      pendingTimer.current = null;
      if (drag.current || keyed.current) return;
      lastSent.current = null;
      setPending(null);
    }, PENDING_TIMEOUT_MS);
  };
  commitRef.current = commit;
  /** Keep the arrow keys on the handle after a pick, so they never reach the map. */
  const focusHandle = () => handleRef.current?.focus({ preventScroll: true });
  /** The point under the pointer, measured on the canvas (inside the window's border). */
  const pointFor = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) aspect.current = rect.width / rect.height;
    return pointAt(rect, clientX, clientY);
  };
  const isOwn = (event: PointerEvent<HTMLDivElement>) =>
    drag.current?.pointerId === event.pointerId;
  /** A pointer that moves the handle takes over from keys still waiting (one message, not two). */
  const supersedeKeys = () => {
    stopTimer(keyTimer);
    keyed.current = false;
  };
  const cancelDrag = () => {
    drag.current = null;
    if (!keyed.current) setPending(null); // Keys still waiting commit on their own.
    setNotice(null);
  };

  return (
    <div className="color-picker">
      <div className="color-picker__label">Colour</div>
      <div
        className="color-picker__window"
        data-testid="color-picker-window"
        // A mousedown here would move focus to the page (a touch tap's compatibility
        // one too), letting the arrows reach the table, or onto a spot, whose blur
        // would send waiting keys as a second message. The handle is focused on release.
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          // The primary button of one pointer: a right-click or a second finger is not a pick.
          if (event.button !== 0 || drag.current) return;
          const onHandle = event.target === handleRef.current;
          const handle = handleRef.current?.getBoundingClientRect();
          const point = pointFor(event.clientX, event.clientY);
          const zoneOwner = onHandle ? null : zoneOwnerAt(point, field);
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            slop: TAP_SLOP_PX[event.pointerType] ?? TAP_SLOP_PX.mouse!,
            onHandle,
            zoneOwner,
            offsetX: onHandle && handle ? handle.left + handle.width / 2 - event.clientX : 0,
            offsetY: onHandle && handle ? handle.top + handle.height / 2 - event.clientY : 0,
            moved: false,
            pressed: null,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          // On the handle, or in a zone, nothing moves until the pointer does.
          if (onHandle || zoneOwner) return;
          supersedeKeys();
          drag.current.pressed = moveTo(point);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active) {
            // A mouse hovering names whose zone this is (a tooltip never shows on the window).
            if (event.pointerType !== "mouse" || noticeTimer.current) return;
            const owner = zoneOwnerAt(pointFor(event.clientX, event.clientY), field);
            setNotice(owner ? { text: `${owner}'s colour`, live: false } : null);
            return;
          }
          if (!isOwn(event)) return;
          const far =
            Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= active.slop;
          if (!active.moved && !far) return;
          if (!active.moved) supersedeKeys();
          active.moved = true;
          moveTo(pointFor(event.clientX + active.offsetX, event.clientY + active.offsetY));
        }}
        onPointerUp={(event) => {
          const active = drag.current;
          if (!active || !isOwn(event)) return;
          drag.current = null;
          focusHandle();
          if (active.onHandle && !active.moved) return; // A tap on your own handle picks nothing.
          if (active.zoneOwner && !active.moved) {
            // A tap in a zone names it (a phone has no hover) and picks nothing.
            setNotice({ text: `${active.zoneOwner}'s colour`, live: true });
          } else if (!active.moved) {
            commit(active.pressed);
          } else {
            commit(
              moveTo(pointFor(event.clientX + active.offsetX, event.clientY + active.offsetY)),
            );
          }
          holdNotice();
        }}
        onPointerCancel={(event) => {
          // A phone turning a vertical swipe into a scroll lands here: nothing is picked.
          if (isOwn(event)) cancelDrag();
        }}
        onLostPointerCapture={(event) => {
          if (isOwn(event)) cancelDrag();
        }}
        onPointerLeave={(event) => {
          if (!drag.current && event.pointerType === "mouse" && !noticeTimer.current) {
            setNotice(null);
          }
        }}
      >
        <canvas
          ref={canvasRef}
          className="color-picker__canvas"
          width={COLOR_WINDOW.columns}
          height={COLOR_WINDOW.rows}
          aria-hidden="true"
        />
        <ColorPickerMarks field={field} />
        {field.suggestions.map((spot, index) => (
          <button
            key={spot.hex}
            type="button"
            className="color-picker__spot"
            style={at(spot)}
            aria-label={`Suggested colour ${index + 1}, ${spot.hex}`}
            title={`A free colour: ${spot.hex}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              stopTimer(pendingTimer);
              setNotice(null);
              setPending(spot);
              commit(spot);
              focusHandle();
            }}
          />
        ))}
        {shown && (
          <div
            ref={handleRef}
            role="slider"
            tabIndex={0}
            aria-label={`${control.name}'s colour`}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={Math.round(shown.u * 360) % 360}
            aria-valuetext={`${shownHex}, hue ${Math.round(shown.u * 360) % 360}°, lightness ${Math.round((shownLightness ?? windowLightness(shown.v)) * 100)}%`}
            className="color-picker__handle"
            style={{ ...at(shown), background: shownHex }}
            onKeyDown={(event) => {
              const step = ARROWS[event.key];
              if (!step) return;
              event.preventDefault();
              // Never let the arrows reach the table's own keys: with a token
              // selected they would walk it (useKeyboardMovement listens on window).
              event.stopPropagation();
              const size = event.shiftKey ? 5 : 1;
              moveTo(stepPoint(shown, step[0] * size, step[1] * size));
              // Commits once the keys go quiet: armed on every press (a held key
              // repeats keydown), so it never waits on a keyup that may not come.
              keyed.current = true;
              stopTimer(keyTimer);
              keyTimer.current = setTimeout(
                () => commitRef.current(pendingRef.current),
                KEY_COMMIT_MS,
              );
            }}
            onKeyUp={(event) => {
              if (ARROWS[event.key]) event.stopPropagation();
            }}
            onBlur={() => {
              if (keyed.current) commitRef.current(pendingRef.current);
            }}
          />
        )}
      </div>
      <div className="color-picker__status">
        {/* Always live, so a bump or tap notice is announced; a hover label is not. */}
        <span aria-live="polite">{notice?.live ? notice.text : null}</span>
        <span>{notice && !notice.live ? notice.text : null}</span>
      </div>
      <ColorPickerPreview name={control.name} hex={shownHex} />
    </div>
  );
}
