// ============================================================================
// MAP-EDIT LAYERS POPOVER
// ============================================================================
// The layer stack for live authoring: visibility, lock, opacity, and reorder,
// driving the existing update-layer / move-layer commands. Ported from the
// Studio's MapStudioLayersPanel (which S13 deletes) and shrunk for the palette.
// Rendered top-most layer first; "up" moves a layer toward the top of the stack
// (a higher array index — array order IS render order).

import type { CSSProperties } from "react";
import type { MapLayer, MapLayerUpdate } from "@herobyte/shared";

interface MapEditLayersPopoverProps {
  layers: MapLayer[];
  saving: boolean;
  onUpdateLayer: (layerId: string, update: MapLayerUpdate) => void;
  onMoveLayer: (layerId: string, targetIndex: number) => void;
}

export function MapEditLayersPopover({
  layers,
  saving,
  onUpdateLayer,
  onMoveLayer,
}: MapEditLayersPopoverProps) {
  const stack = layers.map((layer, index) => ({ layer, index })).reverse();
  return (
    <section aria-label="Layers" style={panelStyle}>
      <ul style={listStyle}>
        {stack.map(({ layer, index }) => (
          <li key={layer.id} style={rowStyle}>
            <div style={rowTopStyle}>
              <button
                aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                disabled={saving}
                onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
                style={iconButtonStyle}
                title={layer.visible ? "Visible" : "Hidden"}
              >
                {layer.visible ? "👁" : "▁"}
              </button>
              <button
                aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
                disabled={saving}
                onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
                style={iconButtonStyle}
                title={layer.locked ? "Locked" : "Unlocked"}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>
              <span className="jrpg-text-small" style={{ flex: 1 }}>
                {layer.name}
              </span>
              <button
                aria-label={`Move ${layer.name} up`}
                disabled={saving || index === layers.length - 1}
                onClick={() => onMoveLayer(layer.id, index + 1)}
                style={iconButtonStyle}
              >
                ▲
              </button>
              <button
                aria-label={`Move ${layer.name} down`}
                disabled={saving || index === 0}
                onClick={() => onMoveLayer(layer.id, index - 1)}
                style={iconButtonStyle}
              >
                ▼
              </button>
            </div>
            <input
              aria-label={`${layer.name} opacity`}
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={layer.opacity}
              disabled={saving}
              onChange={(event) => {
                if (saving) return;
                onUpdateLayer(layer.id, { opacity: Number(event.target.value) });
              }}
              style={{ width: "100%" }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #8a7445",
  background: "#1b1e2a",
  padding: "6px",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const rowStyle: CSSProperties = { border: "1px solid #3a3f52", padding: "4px 6px" };
const rowTopStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "4px" };
const iconButtonStyle: CSSProperties = { fontSize: "10px", padding: "2px 6px", cursor: "pointer" };
