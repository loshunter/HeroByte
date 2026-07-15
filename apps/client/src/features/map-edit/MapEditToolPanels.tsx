// ============================================================================
// MAP-EDIT TOOL PANELS (populate + layers + inspector)
// ============================================================================
// The lower half of the live palette: the POPULATE controls and the collapsible
// Layers / Inspector popovers (the Studio's right-rail chrome, compacted).
// Split out of MapEditToolbar to keep both files under the structure cap.

import { JRPGButton } from "../../components/ui/JRPGPanel";
import { GeneratePanel } from "./GeneratePanel";
import { MapEditLayersPopover } from "./MapEditLayersPopover";
import { MapEditInspectorPopover } from "./MapEditInspectorPopover";
import type { MapEditToolbarProps, PopulateCategory, PopulateDensity } from "./mapEditTypes";

const DENSITIES: PopulateDensity[] = ["low", "medium", "high"];
const CATEGORIES: { id: PopulateCategory; label: string }[] = [
  { id: "objects", label: "Objects" },
  { id: "structures", label: "Structs" },
  { id: "terrain", label: "Terrain" },
];

const labelStyle = { display: "block", marginBottom: "4px", color: "var(--jrpg-gold)" } as const;
const cell = { fontSize: "8px", padding: "6px 2px" } as const;

export function MapEditToolPanels({
  activeSubTool,
  generateParams,
  onGenerateParamsChange,
  onRerollSeed,
  onGenerate,
  canGenerate,
  generateRegion,
  busy,
  populateCategory,
  onSelectPopulateCategory,
  populateDensity,
  onSelectPopulateDensity,
  onPopulate,
  canPopulate,
  saving,
  layers,
  selectedElement,
  onUpdateLayer,
  onMoveLayer,
  onUpdateElement,
  onUpdateDoor,
  onRemoveElement,
  layersOpen,
  onToggleLayers,
  inspectorOpen,
  onToggleInspector,
}: MapEditToolbarProps) {
  // The Generate dials replace the Populate block while its tool is armed —
  // both fill a region, and showing both at once is noise.
  if (activeSubTool === "generate") {
    return (
      <GeneratePanel
        params={generateParams}
        onChange={onGenerateParamsChange}
        onRerollSeed={onRerollSeed}
        onGenerate={onGenerate}
        canGenerate={canGenerate}
        busy={busy}
        region={generateRegion}
      />
    );
  }

  return (
    <>
      <div>
        <label className="jrpg-text-small" style={labelStyle}>
          Populate ({populateCategory}):
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
          {CATEGORIES.map((c) => (
            <JRPGButton
              key={c.id}
              onClick={() => onSelectPopulateCategory(c.id)}
              variant={populateCategory === c.id ? "primary" : "default"}
              style={cell}
            >
              {c.label}
            </JRPGButton>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "4px",
            marginTop: "4px",
          }}
        >
          {DENSITIES.map((d) => (
            <JRPGButton
              key={d}
              onClick={() => onSelectPopulateDensity(d)}
              variant={populateDensity === d ? "primary" : "default"}
              style={cell}
            >
              {d}
            </JRPGButton>
          ))}
        </div>
        <JRPGButton
          onClick={onPopulate}
          variant="success"
          disabled={!canPopulate}
          title="Fill the last room or hallway you placed with set dressing"
          style={{ fontSize: "8px", padding: "7px", width: "100%", marginTop: "4px" }}
        >
          ✨ POPULATE
        </JRPGButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
        <JRPGButton
          onClick={onToggleLayers}
          variant={layersOpen ? "primary" : "default"}
          style={{ fontSize: "8px", padding: "6px" }}
        >
          🗂 Layers
        </JRPGButton>
        <JRPGButton
          onClick={onToggleInspector}
          variant={inspectorOpen ? "primary" : "default"}
          style={{ fontSize: "8px", padding: "6px" }}
        >
          🔍 Inspect
        </JRPGButton>
      </div>

      {layersOpen && (
        <MapEditLayersPopover
          layers={layers}
          saving={saving}
          onUpdateLayer={onUpdateLayer}
          onMoveLayer={onMoveLayer}
        />
      )}

      {inspectorOpen &&
        (selectedElement ? (
          <MapEditInspectorPopover
            element={selectedElement}
            layers={layers}
            disabled={saving}
            onUpdate={onUpdateElement}
            onUpdateDoor={onUpdateDoor}
            onRemove={onRemoveElement}
          />
        ) : (
          <p
            className="jrpg-text-small"
            style={{ margin: 0, color: "var(--jrpg-white)", opacity: 0.7 }}
          >
            Pick the 👆 Select tool and click an element to edit it.
          </p>
        ))}
    </>
  );
}
