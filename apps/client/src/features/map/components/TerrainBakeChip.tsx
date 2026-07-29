// The small "painterly detail is sweeping in" chip (P3): visible only while
// the worker bake streams, fed by the module store in terrainBakeAsync — no
// prop threading through the layout chain. JRPG chrome to match the table.

import { useSyncExternalStore } from "react";
import {
  getTerrainBakeChipServerState,
  getTerrainBakeChipState,
  subscribeTerrainBakeChip,
} from "./terrainBakeChipStore";

export function TerrainBakeChip() {
  const state = useSyncExternalStore(
    subscribeTerrainBakeChip,
    getTerrainBakeChipState,
    getTerrainBakeChipServerState,
  );
  if (!state.pending) return null;
  return (
    <div className="jrpg-text-small" style={chipStyle} role="status" aria-live="polite">
      ⏳ Painting terrain… {Math.round(state.progress * 100)}%
    </div>
  );
}

const chipStyle = {
  position: "absolute",
  left: "10px",
  bottom: "10px",
  zIndex: 150,
  padding: "5px 8px",
  background: "var(--jrpg-panel-dark, #1a1d29)",
  border: "2px solid var(--jrpg-gold)",
  borderRadius: "4px",
  color: "var(--jrpg-gold)",
  pointerEvents: "none",
} as const;
