// ============================================================================
// MAP-EDIT INSPECTOR POPOVER
// ============================================================================
// Numeric transform editor (position / scale / rotation), layer + hidden/locked,
// a door state+width form, and delete for the selected element — driving the
// existing update-element / update-door / remove-element commands. Ported from
// the Studio's MapElementInspector (which S13 deletes) and shrunk for the palette.

import { useEffect, useState } from "react";
import type {
  MapDoorState,
  MapElement,
  MapElementTransform,
  MapElementUpdate,
  MapLayer,
} from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";

interface MapEditInspectorPopoverProps {
  element: MapElement;
  layers: MapLayer[];
  disabled: boolean;
  onUpdate: (elementId: string, update: MapElementUpdate) => void;
  onUpdateDoor: (elementId: string, update: { state: MapDoorState; width: number }) => void;
  onRemove: (elementId: string) => void;
}

export function MapEditInspectorPopover({
  element,
  layers,
  disabled,
  onUpdate,
  onUpdateDoor,
  onRemove,
}: MapEditInspectorPopoverProps) {
  const [transform, setTransform] = useState(element.transform);
  const [layerId, setLayerId] = useState(element.layerId);
  const [hidden, setHidden] = useState(element.hidden);
  const [doorState, setDoorState] = useState<MapDoorState>(
    element.type === "door" ? element.data.state : "closed",
  );
  const [doorWidth, setDoorWidth] = useState<number>(
    element.type === "door" ? element.data.width : 50,
  );

  useEffect(() => {
    setTransform(element.transform);
    setLayerId(element.layerId);
    setHidden(element.hidden);
    if (element.type === "door") {
      setDoorState(element.data.state);
      setDoorWidth(element.data.width);
    }
  }, [element]);

  const num = (key: keyof MapElementTransform, raw: string) => {
    const value = Number(raw);
    if (Number.isFinite(value)) setTransform((current) => ({ ...current, [key]: value }));
  };

  return (
    <fieldset disabled={disabled} style={panelStyle}>
      <legend className="jrpg-text-small">Edit {element.type}</legend>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "6px",
        }}
      >
        <NumInput label="X" value={transform.x} onChange={(v) => num("x", v)} />
        <NumInput label="Y" value={transform.y} onChange={(v) => num("y", v)} />
        <NumInput
          label="Scale X"
          value={transform.scaleX}
          step={0.05}
          onChange={(v) => num("scaleX", v)}
        />
        <NumInput
          label="Scale Y"
          value={transform.scaleY}
          step={0.05}
          onChange={(v) => num("scaleY", v)}
        />
        <NumInput
          label="Rotation"
          value={transform.rotation}
          step={1}
          onChange={(v) => num("rotation", v)}
        />
        <label className="jrpg-text-small" style={cellStyle}>
          Layer
          <select
            aria-label="Element layer"
            value={layerId}
            onChange={(e) => setLayerId(e.target.value)}
            style={controlStyle}
          >
            {layers
              .filter((layer) => !layer.locked || layer.id === element.layerId)
              .map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
          </select>
        </label>
        <label className="jrpg-text-small" style={cellStyle}>
          <input
            aria-label="Hide element"
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
          />{" "}
          Hidden
        </label>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "4px",
          marginTop: "8px",
        }}
      >
        <JRPGButton
          style={{ fontSize: "9px" }}
          disabled={transform.scaleX <= 0 || transform.scaleY <= 0}
          onClick={() => onUpdate(element.id, { transform, layerId, hidden })}
        >
          APPLY
        </JRPGButton>
        <JRPGButton
          variant="danger"
          style={{ fontSize: "9px" }}
          onClick={() => onRemove(element.id)}
        >
          DELETE
        </JRPGButton>
      </div>
      {element.type === "door" && (
        <div style={{ marginTop: "8px", borderTop: "1px solid #8a7445", paddingTop: "8px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "6px",
            }}
          >
            <label className="jrpg-text-small" style={cellStyle}>
              State
              <select
                aria-label="Door state"
                value={doorState}
                onChange={(e) => setDoorState(e.target.value as MapDoorState)}
                style={controlStyle}
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="locked">Locked</option>
                <option value="secret">Secret</option>
              </select>
            </label>
            <label className="jrpg-text-small" style={cellStyle}>
              Width
              <input
                aria-label="Door width"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={doorWidth}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value)) setDoorWidth(value);
                }}
                style={controlStyle}
              />
            </label>
          </div>
          <JRPGButton
            // border-box for the reason controlStyle gives: .jrpg-button has a
            // 2px border, so `width: 100%` alone makes this 4px wider than the
            // cell holding it. It does not clip today (the fieldset sits well
            // inside the palette) but it breaks this file's own stated rule.
            style={{ width: "100%", boxSizing: "border-box", marginTop: "8px", fontSize: "9px" }}
            disabled={doorWidth <= 0 || doorWidth > 1000}
            onClick={() => onUpdateDoor(element.id, { state: doorState, width: doorWidth })}
          >
            APPLY DOOR
          </JRPGButton>
        </div>
      )}
    </fieldset>
  );
}

function NumInput({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="jrpg-text-small" style={cellStyle}>
      {label}
      <input
        aria-label={label}
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={controlStyle}
      />
    </label>
  );
}

// The palette hosting this is a 200-260px window, and everything below exists
// to make the form FIT it instead of overhanging its right edge.
//
// THE LOAD-BEARING ONE IS `controlStyle`'s border-box, and it is the only one.
// Measured in the mounted component at a 242px palette, worst overhang of any
// control past the clipping edge, each declaration applied ALONE:
//
//   before this commit .......... +54px
//   border-box on controls ...... -35px  (fits, and equals the full set)
//   minmax(0, 1fr) tracks ....... +51px
//   min-width: 0 on the cells ... +51px
//   min-inline-size: 0 .......... +54px  (no effect at all)
//   all four together ........... -35px
//
// An earlier version of this comment called `minInlineSize` the load-bearing
// one and said nothing else worked until it was off. That was a plausible
// story, not a measurement, and the measurement says it does nothing here:
// Chrome resolves these controls' `width: 100%` to zero for intrinsic sizing,
// so the grid's min-content never reaches the fieldset's floor in the first
// place. The other three stay as defence in depth — they are what stops the
// form re-overflowing if a control is ever given an intrinsic width instead —
// but do not credit them with the fix.
const panelStyle = {
  border: "1px solid #8a7445",
  padding: "6px",
  boxSizing: "border-box",
  minInlineSize: "0px",
  minWidth: 0,
  maxWidth: "100%",
} as const;

// Grid items default to `min-width: auto`, which is min-content — and the
// min-content width of an <input type="number"> is its 20-character default
// size plus spinners, roughly 160px. Defence in depth, per the measurement
// above: on its own this moves the overhang 54px -> 51px.
const cellStyle = { minWidth: 0 } as const;

// THIS is the one that does the work. `width: 100%` is a CONTENT width without
// border-box (this project has no global reset, on purpose), so each bordered
// control rendered wider than the track it was given and the right column,
// DELETE and the door actions hung past the clipped edge — the same trap
// herobyte.css records for buttons.
const controlStyle = { width: "100%", boxSizing: "border-box", minWidth: 0 } as const;
