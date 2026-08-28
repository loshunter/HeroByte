// The layer stack, with a finger.
//
// This is not a nice-to-have on a phone. The **Lighting layer's opacity IS the
// ambient light** — 1 is day, lower is night, and the torch pools only glow
// once it drops. Without this panel a DM authoring on a tablet can place lights
// and never turn the lights down, which is most of what lighting is for.
//
// The desktop MapEditLayersPopover is reused in SHAPE (visible / lock / name /
// reorder / opacity) but not in code: its buttons are 10px type at 2px padding,
// roughly a third of the touch floor, and importing it would drag the desktop
// map-edit chunk into the entry bundle every PLAYER downloads.
//
// A DISCLOSURE, closed by default, and that is load-bearing rather than tidy.
// The sheet is bottom-anchored, so every row it grows is map the DM can no
// longer tap — the fifth grid column exists because three tool tiles cost a row
// (mobile-map-edit-panels.spec.ts holds the floor).
//
// Which is why the TOGGLE is a cell in the tool grid and only the BODY is a
// footer. As a full-width row it cost 16px of map on a tablet and the floor
// caught it; in the grid it costs nothing, because 14 buttons across five
// columns already leave a slot empty. It sits with Select, Sample and Recenter
// — the things in that grid that are not drag tools.
//
// Open state rides the SAME `layersOpen` the desktop popover uses, so a tablet
// DM who opens it and rotates across the layout rule does not have to open it
// again.

import React from "react";
import type { MapLayer, MapLayerUpdate } from "@herobyte/shared";

interface MobileLayersPanelProps {
  layers: MapLayer[];
  open: boolean;
  saving: boolean;
  onUpdateLayer: (layerId: string, update: MapLayerUpdate) => void;
}

export function MobileLayersPanel({
  layers,
  open,
  saving,
  onUpdateLayer,
}: MobileLayersPanelProps): JSX.Element | null {
  if (!open || layers.length === 0) return null;

  // Top-most first, matching the desktop popover and matching what a DM sees:
  // array order IS render order, so the last layer is the one on top.
  const stack = [...layers].reverse();

  return (
    <div className="mobile-tool-sheet__section" data-testid="mobile-layers">
      {stack.map((layer) => (
        <div key={layer.id} className="mobile-layer-row">
          <button
            type="button"
            aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
            aria-pressed={layer.visible}
            className="mobile-tool-sheet__button"
            disabled={saving}
            onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
          >
            {layer.visible ? "👁" : "▁"}
          </button>
          <button
            type="button"
            aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
            aria-pressed={layer.locked}
            className="mobile-tool-sheet__button"
            disabled={saving}
            onClick={() => onUpdateLayer(layer.id, { locked: !layer.locked })}
          >
            {layer.locked ? "🔒" : "🔓"}
          </button>
          <label className="mobile-layer-row__slider">
            <span className="mobile-tool-sheet__label">
              {layer.name} — {Math.round(layer.opacity * 100)}%
            </span>
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
            />
          </label>
        </div>
      ))}
      {/* Reordering is absent on purpose. It is the one control here that is a
      LAYOUT decision rather than a live one, the stack a live map ships
      with is already in the order the renderer expects, and two 44px
      arrows per row would double the height of a panel that is already
      competing with the map for space. It stays on the desktop, where the
      popover has room for it. */}
    </div>
  );
}
