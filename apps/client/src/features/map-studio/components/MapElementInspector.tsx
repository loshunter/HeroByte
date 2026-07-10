import { useEffect, useState } from "react";
import type {
  MapDoorState,
  MapElement,
  MapElementTransform,
  MapElementUpdate,
  MapLayer,
} from "@herobyte/shared";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

interface MapElementInspectorProps {
  element: MapElement;
  layers: MapLayer[];
  disabled: boolean;
  onUpdate: (elementId: string, update: MapElementUpdate) => void;
  onUpdateDoor: (elementId: string, update: { state: MapDoorState; width: number }) => void;
}

export function MapElementInspector({
  element,
  layers,
  disabled,
  onUpdate,
  onUpdateDoor,
}: MapElementInspectorProps) {
  const [transform, setTransform] = useState(element.transform);
  const [layerId, setLayerId] = useState(element.layerId);
  const [hidden, setHidden] = useState(element.hidden);
  const [locked, setLocked] = useState(element.locked);
  // Door authoring (state + width) — a dedicated path, separate from the
  // transform APPLY. Rotation/position stay on the transform inspector above.
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
    setLocked(element.locked);
    if (element.type === "door") {
      setDoorState(element.data.state);
      setDoorWidth(element.data.width);
    }
  }, [element]);

  const number = (key: keyof MapElementTransform, raw: string) => {
    const value = Number(raw);
    if (Number.isFinite(value)) setTransform((current) => ({ ...current, [key]: value }));
  };

  return (
    <fieldset
      disabled={disabled}
      style={{ border: "1px solid #8a7445", padding: "8px", marginTop: "6px" }}
    >
      <legend className="jrpg-text-small">Edit {element.type}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <TransformInput
          label="Element X"
          value={transform.x}
          onChange={(value) => number("x", value)}
        />
        <TransformInput
          label="Element Y"
          value={transform.y}
          onChange={(value) => number("y", value)}
        />
        <TransformInput
          label="Element scale X"
          value={transform.scaleX}
          minimum={0.01}
          step={0.05}
          onChange={(value) => number("scaleX", value)}
        />
        <TransformInput
          label="Element scale Y"
          value={transform.scaleY}
          minimum={0.01}
          step={0.05}
          onChange={(value) => number("scaleY", value)}
        />
        <TransformInput
          label="Element rotation"
          value={transform.rotation}
          step={1}
          onChange={(value) => number("rotation", value)}
        />
        <label className="jrpg-text-small">
          Layer
          <select
            aria-label="Element layer"
            value={layerId}
            onChange={(event) => setLayerId(event.target.value)}
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
            onChange={(event) => setHidden(event.target.checked)}
          />{" "}
          Hidden
        </label>
        <label className="jrpg-text-small">
          <input
            aria-label="Lock element"
            type="checkbox"
            checked={locked}
            onChange={(event) => setLocked(event.target.checked)}
          />{" "}
          Locked
        </label>
      </div>
      <JRPGButton
        style={{ width: "100%", marginTop: "8px", fontSize: "10px" }}
        disabled={transform.scaleX <= 0 || transform.scaleY <= 0}
        onClick={() => onUpdate(element.id, { transform, layerId, hidden, locked })}
      >
        APPLY ELEMENT
      </JRPGButton>
      {element.type === "door" && (
        <div style={{ marginTop: "8px", borderTop: "1px solid #8a7445", paddingTop: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <label className="jrpg-text-small">
              Door state
              <select
                aria-label="Door state"
                value={doorState}
                onChange={(event) => setDoorState(event.target.value as MapDoorState)}
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
                <option value="locked">Locked</option>
                <option value="secret">Secret (DM only)</option>
              </select>
            </label>
            <label className="jrpg-text-small">
              Door width
              <input
                aria-label="Door width"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={doorWidth}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) setDoorWidth(value);
                }}
                style={{ width: "100%" }}
              />
            </label>
          </div>
          <JRPGButton
            style={{ width: "100%", marginTop: "8px", fontSize: "10px" }}
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

function TransformInput({
  label,
  value,
  minimum,
  step,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={label}
        type="number"
        min={minimum}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: "100%" }}
      />
    </label>
  );
}
