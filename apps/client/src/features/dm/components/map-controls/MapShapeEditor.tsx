import { useEffect, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { JRPGButton } from "../../../../components/ui/JRPGPanel";
import type { MapShapeDraft } from "../../../map-studio";

interface MapShapeEditorProps {
  document: MapDocument;
  disabled: boolean;
  onAddShape: (draft: MapShapeDraft) => string | null;
}

export function MapShapeEditor({ document, disabled, onAddShape }: MapShapeEditorProps) {
  const editableLayers = document.layers.filter((layer) => !layer.locked);
  const [layerId, setLayerId] = useState(editableLayers[0]?.id ?? "");
  const [shape, setShape] = useState<MapShapeDraft["shape"]>("rectangle");
  const [x, setX] = useState(document.grid.size);
  const [y, setY] = useState(document.grid.size);
  const [width, setWidth] = useState(document.grid.size * 4);
  const [height, setHeight] = useState(document.grid.size * 3);
  const [fill, setFill] = useState("#594d6d");
  const [stroke, setStroke] = useState("#d8c99b");

  useEffect(() => {
    if (!editableLayers.some((layer) => layer.id === layerId)) {
      setLayerId(editableLayers[0]?.id ?? "");
    }
  }, [editableLayers, layerId]);

  const add = () => {
    if (!layerId || width <= 0 || height <= 0) return;
    onAddShape({ layerId, shape, x, y, width, height, fill, stroke });
  };

  return (
    <fieldset
      disabled={disabled}
      style={{ border: "1px solid rgba(255,255,255,0.18)", padding: "8px" }}
    >
      <legend className="jrpg-text-small">Add map shape</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <label className="jrpg-text-small">
          Shape
          <select
            aria-label="Shape type"
            value={shape}
            onChange={(event) => setShape(event.target.value as MapShapeDraft["shape"])}
          >
            <option value="rectangle">Room / rectangle</option>
            <option value="ellipse">Ellipse</option>
          </select>
        </label>
        <label className="jrpg-text-small">
          Layer
          <select
            aria-label="Shape layer"
            value={layerId}
            onChange={(event) => setLayerId(event.target.value)}
          >
            {editableLayers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
        <NumberInput label="Shape X" value={x} onChange={setX} />
        <NumberInput label="Shape Y" value={y} onChange={setY} />
        <NumberInput label="Shape width" value={width} minimum={1} onChange={setWidth} />
        <NumberInput label="Shape height" value={height} minimum={1} onChange={setHeight} />
        <ColorInput label="Fill color" value={fill} onChange={setFill} />
        <ColorInput label="Stroke color" value={stroke} onChange={setStroke} />
      </div>
      <JRPGButton
        style={{ width: "100%", marginTop: "8px", fontSize: "10px" }}
        disabled={!layerId || width <= 0 || height <= 0}
        onClick={add}
      >
        ADD TO MAP
      </JRPGButton>
    </fieldset>
  );
}

function NumberInput({
  label,
  value,
  minimum,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={label}
        type="number"
        min={minimum}
        value={value}
        onChange={(event) => setFinite(event.target.value, onChange)}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={label}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: "100%" }}
      />
    </label>
  );
}

function setFinite(raw: string, onChange: (value: number) => void): void {
  const value = Number(raw);
  if (Number.isFinite(value)) onChange(value);
}
