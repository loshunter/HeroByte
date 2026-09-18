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
            // Belt and braces, and honestly a no-op: `button` is already
            // border-box in the UA stylesheet, so `width: 100%` alone renders
            // this exactly its cell's width (probed: 100px in a 100px box, with
            // and without). Kept so the rule above is visible at every
            // `width: 100%` in this file, not because it changes anything.
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
// WHAT ACTUALLY DOES IT: `controlStyle`'s `width: 100%`, because this commit is
// where the two <select>s get a width for the first time. Probed in the app,
// min-content of a Layer cell holding the real option text:
//
//   <select> with no width .......... 170px
//   <select style="width: 100%" ...... 43px
//
// Two 170px cells cannot fit the ~193px this fieldset is given, and that is the
// blow-out. `box-sizing: border-box` is real but secondary — it is worth each
// NUMBER input's own padding and border, measured as 120px -> 100px inside a
// 100px box — and it is INERT on the selects and buttons, which the UA
// stylesheet already sizes as border-box (both render exactly 100px in a 100px
// box with or without the declaration). It also cannot relieve track pressure
// at all: an input's min-content is 20px either way.
//
// An earlier version of this comment credited border-box with the whole fix and
// carried a per-declaration table to prove it. That table was measured with a
// confounded experiment — the "border-box only" variant also applied
// `width: 100%` to selects that previously had none — so it attributed the
// selects' collapse to the wrong declaration. Do not restore it.
//
// The fieldset's `min-inline-size: 0`, the minmax(0, 1fr) tracks and the cells'
// min-width are defence in depth: they are what stops the form re-overflowing
// if a control is ever given an intrinsic width instead of a percentage one.
const panelStyle = {
  border: "1px solid #8a7445",
  padding: "6px",
  boxSizing: "border-box",
  minInlineSize: "0px",
  minWidth: 0,
  maxWidth: "100%",
} as const;

// Grid items default to `min-width: auto`, which is min-content. Defence in
// depth, per the note above.
const cellStyle = { minWidth: 0 } as const;

// `width` is the load-bearing half here; `boxSizing` matters for the number
// inputs only (this project has no global reset, on purpose, so `width: 100%`
// on a content-box control is a CONTENT width and the control renders wider
// than its track by its own padding and border).
//
// The overflow did not get cut away, by the way — DraggableWindow's root is
// `overflow: hidden` but the box that actually holds this fieldset is its
// content div at `overflow: auto`, so the right column, DELETE and the door
// actions sat past a fold that only a horizontal scroll reaches.
const controlStyle = { width: "100%", boxSizing: "border-box", minWidth: 0 } as const;
