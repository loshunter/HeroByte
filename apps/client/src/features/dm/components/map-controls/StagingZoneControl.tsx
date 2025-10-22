// ============================================================================
// STAGING ZONE CONTROL COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 4: Map Controls refactoring.
// Provides controls for managing the player staging zone, which defines where
// players spawn when joining the game. Includes complex viewport-to-world
// coordinate calculations for automatic zone placement.

import { useState, useEffect } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { CollapsibleSection } from "../../../../components/ui/CollapsibleSection";

/**
 * Props for the StagingZoneControl component.
 *
 * @property playerStagingZone - Current staging zone configuration, if set
 * @property playerStagingZone.x - Center X position in grid coordinates
 * @property playerStagingZone.y - Center Y position in grid coordinates
 * @property playerStagingZone.width - Width in grid tiles
 * @property playerStagingZone.height - Height in grid tiles
 * @property playerStagingZone.rotation - Rotation angle in degrees (optional)
 * @property camera - Current camera state for viewport calculations
 * @property camera.x - Camera X offset in pixels
 * @property camera.y - Camera Y offset in pixels
 * @property camera.scale - Camera zoom scale factor
 * @property gridSize - Size of a single grid tile in pixels
 * @property stagingZoneLocked - Whether the staging zone controls are locked
 * @property onStagingZoneLockToggle - Callback when lock/unlock button is clicked
 * @property onSetPlayerStagingZone - Callback when staging zone is applied or cleared
 */
interface StagingZoneControlProps {
  playerStagingZone?: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
  camera: {
    x: number;
    y: number;
    scale: number;
  };
  gridSize: number;
  stagingZoneLocked: boolean;
  onStagingZoneLockToggle?: () => void;
  onSetPlayerStagingZone?: (
    zone:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
          rotation: number;
        }
      | undefined,
  ) => void;
}

/**
 * Staging Zone Control
 *
 * Manages the player staging zone where players spawn when joining the game.
 * Features include:
 * - Manual input fields for precise zone positioning and sizing
 * - "Apply Zone" button that creates/updates the zone based on current viewport
 * - Complex viewport-to-world coordinate calculations to position zone at screen center
 * - Automatic zone sizing to approximately 40% of viewport dimensions
 * - "Clear Zone" button to remove the staging zone
 * - Lock/unlock toggle that collapses the controls when locked
 * - Local state synchronization with playerStagingZone prop
 *
 * The Apply Zone calculation performs viewport-to-world coordinate transformation:
 * 1. Finds viewport center in screen coordinates
 * 2. Converts to world coordinates using camera transform
 * 3. Converts world pixels to grid coordinates
 * 4. Calculates zone size based on viewport dimensions and zoom level
 *
 * All mathematical logic in handleStagingZoneApply must be preserved exactly
 * to maintain correct coordinate transformations.
 */
export function StagingZoneControl({
  playerStagingZone,
  camera,
  gridSize,
  stagingZoneLocked,
  onStagingZoneLockToggle,
  onSetPlayerStagingZone,
}: StagingZoneControlProps) {
  const [stagingInputs, setStagingInputs] = useState({
    x: "0",
    y: "0",
    width: "6",
    height: "6",
    rotation: "0",
  });

  useEffect(() => {
    if (playerStagingZone) {
      setStagingInputs({
        x: playerStagingZone.x.toFixed(2),
        y: playerStagingZone.y.toFixed(2),
        width: playerStagingZone.width.toFixed(2),
        height: playerStagingZone.height.toFixed(2),
        rotation: (playerStagingZone.rotation ?? 0).toFixed(1),
      });
    } else {
      setStagingInputs({
        x: "0",
        y: "0",
        width: "6",
        height: "6",
        rotation: "0",
      });
    }
  }, [playerStagingZone]);

  const handleStagingInputChange = (field: keyof typeof stagingInputs, value: string) => {
    setStagingInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleStagingZoneApply = () => {
    if (!onSetPlayerStagingZone) return;

    // Calculate viewport center in world coordinates
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 800;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;
    const centerScreenX = viewportWidth / 2;
    const centerScreenY = viewportHeight / 2;

    // Convert screen center to world coordinates
    const centerWorldX = (centerScreenX - camera.x) / camera.scale;
    const centerWorldY = (centerScreenY - camera.y) / camera.scale;

    // Calculate staging zone size based on viewport and current zoom
    // Aim for about 40% of viewport width, minimum 1 grid unit
    const viewportWidthInWorld = viewportWidth / camera.scale;
    const viewportHeightInWorld = viewportHeight / camera.scale;

    // Size as a fraction of viewport, converted to grid units
    const sizeWidthInPixels = viewportWidthInWorld * 0.4;
    const sizeHeightInPixels = viewportHeightInWorld * 0.4;

    const calculatedWidth = Math.max(1, sizeWidthInPixels / gridSize);
    const calculatedHeight = Math.max(1, sizeHeightInPixels / gridSize);

    // Convert world pixel coordinates to grid coordinates
    const gridX = centerWorldX / gridSize;
    const gridY = centerWorldY / gridSize;

    // Update the input fields to reflect calculated values
    setStagingInputs({
      x: gridX.toFixed(2),
      y: gridY.toFixed(2),
      width: calculatedWidth.toFixed(2),
      height: calculatedHeight.toFixed(2),
      rotation: "0",
    });

    onSetPlayerStagingZone({
      x: gridX,
      y: gridY,
      width: calculatedWidth,
      height: calculatedHeight,
      rotation: 0,
    });
  };

  const handleStagingZoneClear = () => {
    if (!onSetPlayerStagingZone) return;
    onSetPlayerStagingZone(undefined);
  };

  return (
    <JRPGPanel
      variant="simple"
      title="Player Staging Zone"
      style={{
        padding: stagingZoneLocked ? "8px" : "12px",
        transition: "padding 150ms ease-in-out",
        border: stagingZoneLocked
          ? "2px solid rgba(136, 136, 136, 0.5)"
          : "2px solid var(--jrpg-border-gold)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {onStagingZoneLockToggle && (
          <JRPGButton
            onClick={onStagingZoneLockToggle}
            variant={stagingZoneLocked ? "default" : "primary"}
            style={{
              fontSize: "11px",
              fontWeight: "bold",
              padding: "8px",
              background: stagingZoneLocked ? "rgba(136, 136, 136, 0.2)" : undefined,
              color: stagingZoneLocked ? "#aaa" : undefined,
            }}
            title={stagingZoneLocked ? "Staging zone is locked" : "Staging zone is unlocked"}
          >
            {stagingZoneLocked ? "🔒 ZONE LOCKED ▲" : "🔓 ZONE UNLOCKED ▼"}
          </JRPGButton>
        )}

        <CollapsibleSection isCollapsed={stagingZoneLocked ?? false}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "8px",
              }}
            >
              <label
                className="jrpg-text-small"
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                Center X
                <input
                  type="number"
                  value={stagingInputs.x}
                  onChange={(event) => handleStagingInputChange("x", event.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    background: "#111",
                    color: "var(--jrpg-white)",
                    border: "1px solid var(--jrpg-border-gold)",
                  }}
                  step={0.1}
                />
              </label>
              <label
                className="jrpg-text-small"
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                Center Y
                <input
                  type="number"
                  value={stagingInputs.y}
                  onChange={(event) => handleStagingInputChange("y", event.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    background: "#111",
                    color: "var(--jrpg-white)",
                    border: "1px solid var(--jrpg-border-gold)",
                  }}
                  step={0.1}
                />
              </label>
              <label
                className="jrpg-text-small"
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                Width (tiles)
                <input
                  type="number"
                  min={0.5}
                  value={stagingInputs.width}
                  onChange={(event) => handleStagingInputChange("width", event.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    background: "#111",
                    color: "var(--jrpg-white)",
                    border: "1px solid var(--jrpg-border-gold)",
                  }}
                  step={0.5}
                />
              </label>
              <label
                className="jrpg-text-small"
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                Height (tiles)
                <input
                  type="number"
                  min={0.5}
                  value={stagingInputs.height}
                  onChange={(event) => handleStagingInputChange("height", event.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    background: "#111",
                    color: "var(--jrpg-white)",
                    border: "1px solid var(--jrpg-border-gold)",
                  }}
                  step={0.5}
                />
              </label>
            </div>
            <label
              className="jrpg-text-small"
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              Rotation (degrees)
              <input
                type="number"
                value={stagingInputs.rotation}
                onChange={(event) => handleStagingInputChange("rotation", event.target.value)}
                style={{
                  width: "100%",
                  padding: "6px",
                  background: "#111",
                  color: "var(--jrpg-white)",
                  border: "1px solid var(--jrpg-border-gold)",
                }}
                step={1}
              />
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <JRPGButton
                onClick={handleStagingZoneApply}
                variant="primary"
                style={{ fontSize: "10px", flex: "1 1 auto" }}
                disabled={!onSetPlayerStagingZone}
              >
                Apply Zone
              </JRPGButton>
              <JRPGButton
                onClick={handleStagingZoneClear}
                variant="danger"
                style={{ fontSize: "10px", flex: "1 1 auto" }}
                disabled={!onSetPlayerStagingZone}
              >
                Clear Zone
              </JRPGButton>
            </div>
            <span className="jrpg-text-tiny" style={{ color: "var(--jrpg-white)", opacity: 0.6 }}>
              Click &ldquo;Apply Zone&rdquo; to create/update the staging zone. Use the Transform
              tool to move and resize it on the map. Players spawn randomly within this area.
            </span>
          </div>
        </CollapsibleSection>
      </div>
    </JRPGPanel>
  );
}
