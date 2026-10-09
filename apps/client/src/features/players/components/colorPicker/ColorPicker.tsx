// ============================================================================
// COLOUR PICKER — choose your character's colour (personal colour, C1)
// ============================================================================
// A hue × lightness window (hue wraps left to right, light at the top). Other
// players' colours hold zones, drawn darkened; dragging into one stops the
// handle at its edge. Three suggested spots mark the most open colours: one
// tap lands there, which is the whole job on a phone. The colour commits on
// release (one message), the preview follows the handle while dragging, and
// the server has the last word: a stale picker (someone joined) is snapped,
// and the sender is told. The DM's picker has no zones (the DM is exempt).

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { COLOR_WINDOW, windowCells, windowPointOf, type WindowCell } from "@herobyte/shared";
import {
  cellOf,
  pickerField,
  pickerFieldKey,
  placeHandle,
  pointAt,
  sameColor,
  stepPoint,
  type ColorPickerControl,
  type PickerField,
} from "./colorPickerModel";
import "./colorPicker.css";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Zone cells are drawn this much darker, so the free colours stand out. */
const ZONE_DIM = 0.35;

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

export function ColorPicker(control: ColorPickerControl): JSX.Element {
  const fieldKey = pickerFieldKey(control);
  // Keyed, not on `control`: the holders arrive as a new array every snapshot.
  const field = useMemo(() => pickerField(control), [fieldKey]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<WindowCell | null>(null);
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const dragging = useRef(false);

  useEffect(() => drawWindow(canvasRef.current, field), [field]);
  // The server's answer (or anyone's recolour) replaces whatever was pending, and
  // retires the bump notice that belonged to it.
  useEffect(() => {
    setPending(null);
    setBlockedBy(null);
  }, [control.color]);

  const committedCell = cellOf(control.color);
  const shown = pending ?? committedCell;
  const shownHex = pending?.hex ?? control.color;

  const moveTo = (point: { u: number; v: number }) => {
    const placed = placeHandle(point, field, control.exempt);
    setPending(placed.cell);
    setBlockedBy(placed.blockedBy ?? null);
    return placed.cell;
  };
  const commit = (cell: WindowCell | null) => {
    if (!cell || sameColor(cell.hex, control.color)) {
      setPending(null);
      return;
    }
    control.onCommit(cell.hex);
  };
  const pointFor = (event: PointerEvent<HTMLDivElement>) =>
    pointAt(windowRef.current!.getBoundingClientRect(), event.clientX, event.clientY);

  return (
    <div className="color-picker">
      <div className="color-picker__label">Colour</div>
      <div
        ref={windowRef}
        className="color-picker__window"
        data-testid="color-picker-window"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          moveTo(pointFor(event));
        }}
        onPointerMove={(event) => {
          if (dragging.current) moveTo(pointFor(event));
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          commit(moveTo(pointFor(event)));
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setPending(null);
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
            aria-label={`Suggested colour ${index + 1}`}
            title={`A free colour: ${spot.hex}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setBlockedBy(null);
              setPending(spot);
              commit(spot);
            }}
          />
        ))}
        {shown && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={`${control.name}'s colour`}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={Math.round(shown.u * 360) % 360}
            aria-valuetext={`${shownHex}, hue ${Math.round(shown.u * 360) % 360}°, lightness ${Math.round((1 - shown.v) * 100)}%`}
            className="color-picker__handle"
            style={{ ...at(shown), background: shownHex }}
            onKeyDown={(event) => {
              const step = ARROWS[event.key];
              if (!step) return;
              event.preventDefault();
              const size = event.shiftKey ? 5 : 1;
              moveTo(stepPoint(shown, step[0] * size, step[1] * size));
            }}
            onKeyUp={(event) => {
              if (ARROWS[event.key]) commit(pending);
            }}
          />
        )}
      </div>
      <div className="color-picker__status" aria-live="polite">
        {blockedBy ? `Too close to ${blockedBy}` : null}
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
