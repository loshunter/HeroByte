// ============================================================================
// COLOUR PICKER — choose your character's colour (personal colour, C1)
// ============================================================================
// A hue × lightness window (hue wraps left to right, light at the top). Other
// players' colours hold zones, drawn darkened; dragging into one stops the
// handle at its edge. Three suggested spots mark the most open colours: one
// tap lands there, which is the whole job on a phone. A drag commits on
// release (one message), arrow keys commit once the keys go quiet, the preview
// follows the handle, and the server has the last word: a stale picker
// (someone joined) is snapped, and the sender is told. The DM's picker has no
// zones (the DM is exempt).

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  COLOR_WINDOW,
  normalizeColor,
  windowCells,
  windowLightness,
  windowPointOf,
  type WindowCell,
} from "@herobyte/shared";
import {
  cellOf,
  pickerField,
  pickerFieldKey,
  placeHandle,
  pointAt,
  sameColor,
  stepPoint,
  zoneOwnerAt,
  type PickerField,
} from "./colorPickerModel";
import type { ColorPickerControl } from "./colorPickerControl";
import "./colorPicker.css";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Zone cells are drawn this much darker, so the free colours stand out. */
const ZONE_DIM = 0.35;
/** Arrow-key steps commit once the keys have been quiet this long (one message, not ten). */
export const KEY_COMMIT_MS = 400;
/** A commit the server answers without changing the colour stops showing after this. */
export const PENDING_TIMEOUT_MS = 1500;
/** A press on the handle that moves less than this is a tap, not a pick. */
const TAP_SLOP_PX = 3;
/** The window's drawn aspect (colorPicker.css), for the edge-stop before it is measured. */
const DRAWN_ASPECT = 2.6;

function drawWindow(canvas: HTMLCanvasElement | null, field: PickerField): void {
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas?.getContext("2d") ?? null;
  } catch {
    context = null; // jsdom: no 2D canvas. The handle, spots and readout are DOM.
  }
  if (!context) return;
  const { columns, rows } = COLOR_WINDOW;
  const image = context.createImageData(columns, rows);
  windowCells().forEach((cell, index) => {
    const dim = field.zones[index] === -1 ? 1 : ZONE_DIM;
    const offset = index * 4;
    image.data[offset] = parseInt(cell.hex.slice(1, 3), 16) * dim;
    image.data[offset + 1] = parseInt(cell.hex.slice(3, 5), 16) * dim;
    image.data[offset + 2] = parseInt(cell.hex.slice(5, 7), 16) * dim;
    image.data[offset + 3] = 255;
  });
  context.putImageData(image, 0, 0);
}

const at = (point: { u: number; v: number }) => ({
  left: `${point.u * 100}%`,
  top: `${point.v * 100}%`,
});

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Pressed on the handle itself: moves keep the grab offset, and a tap is no pick. */
  onHandle: boolean;
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
  const [notice, setNotice] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aspect = useRef(DRAWN_ASPECT);
  const pendingRef = useRef<WindowCell | null>(null);
  pendingRef.current = pending;

  useEffect(() => drawWindow(canvasRef.current, field), [field]);
  // The server's answer (or anyone's recolour) replaces whatever was pending, and
  // retires the bump notice that belonged to it.
  useEffect(() => {
    setPending(null);
    setNotice(null);
  }, [control.color]);
  // Closing the window mid-keystroke still sends the colour the keys chose.
  const commitRef = useRef<(cell: WindowCell | null) => void>(() => {});
  useEffect(
    () => () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      if (keyTimer.current) commitRef.current(pendingRef.current);
    },
    [],
  );

  const committedCell = cellOf(control.color);
  const shown = pending ?? committedCell;
  const shownHex = pending?.hex ?? normalizeColor(control.color) ?? control.color;

  const moveTo = (point: { u: number; v: number }) => {
    const placed = placeHandle(point, field, control.exempt, aspect.current);
    setPending(placed.cell);
    setNotice(placed.blockedBy ? `Too close to ${placed.blockedBy}` : null);
    return placed.cell;
  };
  const commit = (cell: WindowCell | null) => {
    if (keyTimer.current) clearTimeout(keyTimer.current);
    keyTimer.current = null;
    if (!cell || sameColor(cell.hex, control.color)) {
      setPending(null);
      return;
    }
    control.onCommit(cell.hex);
    // An answer that leaves the colour as it was (a snap back) changes nothing to
    // clear the pending one on; it stops showing after a moment instead.
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      if (!drag.current) setPending(null);
    }, PENDING_TIMEOUT_MS);
  };
  /** The point under the pointer, measured on the canvas (inside the window's border). */
  commitRef.current = commit;
  const pointFor = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) aspect.current = rect.width / rect.height;
    return pointAt(rect, clientX, clientY);
  };
  const isOwn = (event: PointerEvent<HTMLDivElement>) =>
    drag.current?.pointerId === event.pointerId;

  return (
    <div className="color-picker">
      <div className="color-picker__label">Colour</div>
      <div
        className="color-picker__window"
        data-testid="color-picker-window"
        onPointerDown={(event) => {
          // The primary button of one pointer: a right-click or a second finger is not a pick.
          if (event.button !== 0 || drag.current) return;
          const onHandle = event.target === handleRef.current;
          const handle = handleRef.current?.getBoundingClientRect();
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            onHandle,
            offsetX: onHandle && handle ? handle.left + handle.width / 2 - event.clientX : 0,
            offsetY: onHandle && handle ? handle.top + handle.height / 2 - event.clientY : 0,
            moved: false,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          if (!onHandle) moveTo(pointFor(event.clientX, event.clientY));
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active) {
            // Hovering names whose zone this is (a tooltip never shows on the window itself).
            const owner = zoneOwnerAt(pointFor(event.clientX, event.clientY), field);
            setNotice(owner ? `${owner}'s colour` : null);
            return;
          }
          if (!isOwn(event)) return;
          const far =
            Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= TAP_SLOP_PX;
          if (!active.moved && !far) return;
          active.moved = true;
          moveTo(pointFor(event.clientX + active.offsetX, event.clientY + active.offsetY));
        }}
        onPointerUp={(event) => {
          const active = drag.current;
          if (!active || !isOwn(event)) return;
          drag.current = null;
          if (active.onHandle && !active.moved) {
            setPending(null); // A tap on your own handle picks nothing.
            return;
          }
          commit(moveTo(pointFor(event.clientX + active.offsetX, event.clientY + active.offsetY)));
        }}
        onPointerCancel={(event) => {
          if (!isOwn(event)) return;
          drag.current = null;
          setPending(null);
          setNotice(null);
        }}
        onPointerLeave={() => {
          if (!drag.current) setNotice(null);
        }}
      >
        <canvas
          ref={canvasRef}
          className="color-picker__canvas"
          width={COLOR_WINDOW.columns}
          height={COLOR_WINDOW.rows}
          aria-hidden="true"
        />
        {field.others.map((other) => {
          const point = windowPointOf(other.color);
          return point ? (
            <span
              key={other.characterId ?? other.color}
              role="img"
              aria-label={`${other.name ?? "Another player"}'s colour`}
              className="color-picker__taken"
              style={{ ...at(point), background: other.color }}
              title={`${other.name ?? "Another player"}'s colour`}
            />
          ) : null;
        })}
        {field.ownDots.map((dot) => {
          const point = windowPointOf(dot.color);
          return point ? (
            <span
              key={dot.characterId ?? dot.color}
              role="img"
              aria-label={`${dot.name ?? "Your other character"}'s colour (yours)`}
              className="color-picker__own"
              style={{ ...at(point), background: dot.color }}
              title={`${dot.name ?? "Your other character"} (yours)`}
            />
          ) : null;
        })}
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
              setNotice(null);
              setPending(spot);
              commit(spot);
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
            aria-valuetext={`${shownHex}, hue ${Math.round(shown.u * 360) % 360}°, lightness ${Math.round(windowLightness(shown.v) * 100)}%`}
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
            }}
            onKeyUp={(event) => {
              if (!ARROWS[event.key]) return;
              event.stopPropagation();
              if (keyTimer.current) clearTimeout(keyTimer.current);
              keyTimer.current = setTimeout(() => commit(pendingRef.current), KEY_COMMIT_MS);
            }}
            onBlur={() => {
              if (keyTimer.current) commit(pendingRef.current);
            }}
          />
        )}
      </div>
      <div className="color-picker__status" aria-live="polite">
        {notice}
      </div>
      <div className="color-picker__preview" aria-hidden="true">
        <span className="color-picker__name" style={{ color: shownHex }}>
          {control.name}
        </span>
        <span className="color-picker__ring" style={{ borderColor: shownHex }} />
        <span
          className="color-picker__token color-picker__token--map"
          style={{ background: shownHex }}
        />
        <span
          className="color-picker__token color-picker__token--fog"
          style={{ background: shownHex }}
        />
      </div>
      <output className="color-picker__hex" aria-label="Colour code">
        {shownHex}
      </output>
    </div>
  );
}
