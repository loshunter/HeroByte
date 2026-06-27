import { useEffect, useState } from "react";
import type { MapGridSettings, MapGridUpdate } from "@herobyte/shared";
import { JRPGButton } from "../../../../components/ui/JRPGPanel";

interface MapGridEditorProps {
  grid: MapGridSettings;
  disabled: boolean;
  onUpdate: (update: MapGridUpdate) => void;
}

export function MapGridEditor({ grid, disabled, onUpdate }: MapGridEditorProps) {
  const [draft, setDraft] = useState(grid);

  useEffect(() => setDraft(grid), [grid]);

  const number = (key: "size" | "squareSize" | "offsetX" | "offsetY", value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setDraft((current) => ({ ...current, [key]: parsed }));
  };

  return (
    <fieldset
      disabled={disabled}
      style={{ border: "1px solid rgba(255,255,255,0.18)", padding: "8px" }}
    >
      <legend className="jrpg-text-small">Document grid</legend>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <label className="jrpg-text-small">
          Grid type
          <select
            aria-label="Grid type"
            value={draft.type}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                type: event.target.value as MapGridSettings["type"],
              }))
            }
          >
            <option value="square">Square</option>
            <option value="hex-row">Hex (rows)</option>
            <option value="hex-column">Hex (columns)</option>
            <option value="isometric">Isometric</option>
          </select>
        </label>
        <GridNumber
          label="Grid size"
          value={draft.size}
          minimum={1}
          onChange={(value) => number("size", value)}
        />
        <GridNumber
          label="Distance per cell"
          value={draft.squareSize}
          minimum={1}
          onChange={(value) => number("squareSize", value)}
        />
        <GridNumber
          label="Grid X offset"
          value={draft.offsetX}
          onChange={(value) => number("offsetX", value)}
        />
        <GridNumber
          label="Grid Y offset"
          value={draft.offsetY}
          onChange={(value) => number("offsetY", value)}
        />
        <label className="jrpg-text-small">
          <input
            aria-label="Show document grid"
            type="checkbox"
            checked={draft.visible}
            onChange={(event) =>
              setDraft((current) => ({ ...current, visible: event.target.checked }))
            }
          />{" "}
          Visible
        </label>
        <label className="jrpg-text-small">
          <input
            aria-label="Snap map elements"
            type="checkbox"
            checked={draft.snap}
            onChange={(event) =>
              setDraft((current) => ({ ...current, snap: event.target.checked }))
            }
          />{" "}
          Snap elements
        </label>
      </div>
      <JRPGButton
        style={{ width: "100%", marginTop: "8px", fontSize: "10px" }}
        disabled={draft.size <= 0 || draft.squareSize <= 0}
        onClick={() => onUpdate(draft)}
      >
        APPLY GRID
      </JRPGButton>
    </fieldset>
  );
}

function GridNumber({
  label,
  value,
  minimum,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="jrpg-text-small">
      {label}
      <input
        aria-label={label}
        type="number"
        min={minimum}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: "100%" }}
      />
    </label>
  );
}
