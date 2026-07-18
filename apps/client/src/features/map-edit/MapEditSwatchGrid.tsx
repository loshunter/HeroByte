// One labelled swatch grid for the map-edit palette (floors, walls, roofs,
// ring choices, hallway widths) — extracted from MapEditToolbar so the toolbar
// stays under the 350-LOC cap as the material groups grow.

import { JRPGButton } from "../../components/ui/JRPGPanel";

const labelStyle = {
  display: "block",
  marginBottom: "4px",
  color: "var(--jrpg-gold)",
} as const;

export interface SwatchOption<T extends string | number> {
  id: T;
  label: string;
}

interface MapEditSwatchGridProps<T extends string | number> {
  label: string;
  options: readonly SwatchOption<T>[];
  selected: T;
  onSelect: (id: T) => void;
  /** Grid column count (default 3). */
  columns?: number;
}

export function MapEditSwatchGrid<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  columns = 3,
}: MapEditSwatchGridProps<T>) {
  return (
    <div>
      <label className="jrpg-text-small" style={labelStyle}>
        {label}
      </label>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: "4px" }}>
        {options.map((option) => (
          <JRPGButton
            key={option.id}
            onClick={() => onSelect(option.id)}
            variant={selected === option.id ? "primary" : "default"}
            style={{ fontSize: "8px", padding: "6px 2px" }}
          >
            {option.label}
          </JRPGButton>
        ))}
      </div>
    </div>
  );
}
