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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
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
        <label className="jrpg-text-small">
          Layer
          <select
            aria-label="Element layer"
            value={layerId}
            onChange={(e) => setLayerId(e.target.value)}
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
        <label className="jrpg-text-small">
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
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginTop: "8px" }}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <label className="jrpg-text-small">
              State
              <select
                aria-label="Door state"
                value={doorState}
                onChange={(e) => setDoorState(e.target.value as MapDoorState)}
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="locked">Locked</option>
                <option value="secret">Secret</option>
              </select>
            </label>
            <label className="jrpg-text-small">
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
                style={{ width: "100%" }}
              />
            </label>
          </div>
          <JRPGButton
            style={{ width: "100%", marginTop: "8px", fontSize: "9px" }}
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
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={label}
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: "100%" }}
      />
    </label>
  );
}

const panelStyle = { border: "1px solid #8a7445", padding: "6px" } as const;
