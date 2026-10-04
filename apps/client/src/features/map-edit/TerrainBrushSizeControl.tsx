import { TERRAIN_BRUSH_SIZES, type TerrainBrushSize } from "../map-studio/terrainBrushGeometry";

/** Both palettes write the same size; the canvas consumes it in document cells. */
export function TerrainBrushSizeControl({
  size,
  onChange,
}: {
  size: TerrainBrushSize;
  onChange: (size: TerrainBrushSize) => void;
}) {
  return (
    <div className="terrain-brush-size" role="group" aria-label="Brush size (cells)">
      <span>Brush size (cells)</span>
      <div>
        {TERRAIN_BRUSH_SIZES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={size === value}
            onClick={() => onChange(value)}
          >
            {value} × {value}
          </button>
        ))}
      </div>
    </div>
  );
}
