// ============================================================================
// MAP TRANSFORM CONTROL COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 4: Map Controls refactoring.
// Provides controls for adjusting map transformation including scale, rotation,
// position, and lock state. Includes CollapsibleSection that collapses when locked.

import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { CollapsibleSection } from "../../../../components/ui/CollapsibleSection";

/**
 * Props for the MapTransformControl component.
 *
 * @property mapTransform - Current transformation state of the map
 * @property mapTransform.scaleX - Horizontal scale factor (0.1 to 3.0)
 * @property mapTransform.scaleY - Vertical scale factor (0.1 to 3.0)
 * @property mapTransform.x - X-axis position offset in pixels
 * @property mapTransform.y - Y-axis position offset in pixels
 * @property mapTransform.rotation - Rotation angle in degrees (0 to 360)
 * @property mapLocked - Whether the map transformation controls are locked
 * @property onMapTransformChange - Callback when any transform value changes
 * @property onMapLockToggle - Callback when lock/unlock button is clicked
 */
interface MapTransformControlProps {
  mapTransform: {
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;
    rotation: number;
  };
  mapLocked: boolean;
  onMapTransformChange: (transform: {
    scaleX: number;
    scaleY: number;
    x: number;
    y: number;
    rotation: number;
  }) => void;
  onMapLockToggle: () => void;
}

/**
 * Map Transform Control
 *
 * Manages map transformation controls including scale, rotation, and position.
 * Features a lock/unlock toggle that collapses the controls when locked.
 * Provides a reset button to restore default transformation values.
 *
 * The component is fully controlled - all state is managed by the parent.
 * Includes accessibility labels for all interactive controls.
 */
export function MapTransformControl({
  mapTransform,
  mapLocked,
  onMapTransformChange,
  onMapLockToggle,
}: MapTransformControlProps) {
  return (
    <JRPGPanel
      variant="simple"
      title="Map Transform"
      style={{
        padding: mapLocked ? "8px" : "12px",
        transition: "padding 150ms ease-in-out",
        border: mapLocked
          ? "2px solid rgba(136, 136, 136, 0.5)"
          : "2px solid var(--jrpg-border-gold)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <JRPGButton
          onClick={onMapLockToggle}
          variant={mapLocked ? "default" : "primary"}
          style={{
            fontSize: "11px",
            fontWeight: "bold",
            padding: "8px",
            background: mapLocked ? "rgba(136, 136, 136, 0.2)" : undefined,
            color: mapLocked ? "#aaa" : undefined,
          }}
          title={mapLocked ? "Map is locked" : "Map is unlocked"}
        >
          {mapLocked ? "🔒 MAP LOCKED ▲" : "🔓 MAP UNLOCKED ▼"}
        </JRPGButton>

        <CollapsibleSection isCollapsed={mapLocked ?? false}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px",
              }}
            >
              <span className="jrpg-text-small">Scale</span>
              <span className="jrpg-text-small">{mapTransform.scaleX.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={3}
              step={0.1}
              value={mapTransform.scaleX}
              onChange={(event) =>
                onMapTransformChange({
                  ...mapTransform,
                  scaleX: Number(event.target.value),
                  scaleY: Number(event.target.value),
                })
              }
              style={{ width: "100%" }}
              aria-label="Scale"
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "8px",
                marginBottom: "4px",
              }}
            >
              <span className="jrpg-text-small">Rotation</span>
              <span className="jrpg-text-small">{Math.round(mapTransform.rotation)}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={mapTransform.rotation}
              onChange={(event) =>
                onMapTransformChange({
                  ...mapTransform,
                  rotation: Number(event.target.value),
                })
              }
              style={{ width: "100%" }}
              aria-label="Rotation"
            />

            <div style={{ marginTop: "8px", display: "flex", gap: "4px" }}>
              <div style={{ flex: 1 }}>
                <label className="jrpg-text-small" style={{ display: "block" }}>
                  X
                </label>
                <input
                  type="number"
                  value={Math.round(mapTransform.x)}
                  onChange={(event) =>
                    onMapTransformChange({
                      ...mapTransform,
                      x: Number(event.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "4px",
                    background: "#111",
                    color: "var(--jrpg-white)",
                    border: "1px solid var(--jrpg-border-gold)",
                    fontSize: "10px",
                  }}
                  aria-label="X"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="jrpg-text-small" style={{ display: "block" }}>
                  Y
                </label>
                <input
                  type="number"
                  value={Math.round(mapTransform.y)}
                  onChange={(event) =>
                    onMapTransformChange({
                      ...mapTransform,
                      y: Number(event.target.value),
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "4px",
                    background: "#111",
                    color: "var(--jrpg-white)",
                    border: "1px solid var(--jrpg-border-gold)",
                    fontSize: "10px",
                  }}
                  aria-label="Y"
                />
              </div>
            </div>

            <JRPGButton
              onClick={() =>
                onMapTransformChange({
                  x: 0,
                  y: 0,
                  scaleX: 1,
                  scaleY: 1,
                  rotation: 0,
                })
              }
              variant="default"
              style={{ fontSize: "10px", marginTop: "8px" }}
            >
              Reset Transform
            </JRPGButton>
          </div>
        </CollapsibleSection>
      </div>
    </JRPGPanel>
  );
}
