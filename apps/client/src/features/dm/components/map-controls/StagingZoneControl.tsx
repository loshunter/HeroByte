// ============================================================================
// STAGING ZONE CONTROL COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 4: Map Controls refactoring.
// Provides controls for managing the player staging zone, which defines where
// players spawn when joining the game. The field parsing and the view-to-tile
// maths live in stagingZoneInputs.ts.

import { useState } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { CollapsibleSection } from "../../../../components/ui/CollapsibleSection";
import {
  MIN_STAGING_SIZE,
  parseStagingInputs,
  parseStagingShape,
  stagingInputsFrom,
  viewCenter,
  viewportZone,
  type StagingInputs,
  type StagingZone,
} from "./stagingZoneInputs";

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
  onSetPlayerStagingZone?: (zone: StagingZone | undefined) => void;
}

const fieldLabelStyle = { display: "flex", flexDirection: "column", gap: "4px" } as const;
const fieldInputStyle = {
  width: "100%",
  padding: "6px",
  background: "#111",
  color: "var(--jrpg-white)",
  border: "1px solid var(--jrpg-border-gold)",
} as const;

function StagingField({
  label,
  value,
  onChange,
  step,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: number;
  min?: number;
}) {
  return (
    <label className="jrpg-text-small" style={fieldLabelStyle}>
      {label}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={fieldInputStyle}
        step={step}
      />
    </label>
  );
}

/**
 * Staging Zone Control
 *
 * Manages the player staging zone where players spawn when joining the game.
 * - "Apply Zone" applies the five fields exactly as typed. The one exception
 *   is a first zone with nothing typed: the 0/0/6/6 placeholders are not a
 *   DM's choice, so it lands centred on the screen at about 40% of its size.
 * - "Center on view" moves the zone's centre to the middle of the screen
 *   and keeps the typed size and rotation.
 * - "Clear Zone" removes the staging zone.
 * - Lock/unlock toggle that collapses the controls when locked.
 *
 * The fields re-sync whenever the table's zone changes, and only then: every
 * snapshot is a fresh object, so syncing on the object itself would wipe what
 * the DM is typing on any unrelated broadcast.
 */
export function StagingZoneControl({
  playerStagingZone,
  camera,
  gridSize,
  stagingZoneLocked,
  onStagingZoneLockToggle,
  onSetPlayerStagingZone,
}: StagingZoneControlProps) {
  const tableInputs = stagingInputsFrom(playerStagingZone);
  const tableKey = playerStagingZone ? Object.values(tableInputs).join("|") : "none";
  const [stagingInputs, setStagingInputs] = useState<StagingInputs>(tableInputs);
  // True once the DM types into a field; cleared when the fields re-sync.
  const [edited, setEdited] = useState(false);
  // Re-sync by value, not by object identity: see the component doc.
  const [syncedKey, setSyncedKey] = useState(tableKey);
  if (syncedKey !== tableKey) {
    setSyncedKey(tableKey);
    setStagingInputs(tableInputs);
    setEdited(false);
  }

  const handleStagingInputChange = (field: keyof StagingInputs, value: string) => {
    setStagingInputs((prev) => ({ ...prev, [field]: value }));
    setEdited(true);
  };

  const firstZoneFromView = !playerStagingZone && !edited;
  const typedZone = parseStagingInputs(stagingInputs);
  const typedShape = parseStagingShape(stagingInputs);
  const canApply = Boolean(onSetPlayerStagingZone) && (firstZoneFromView || typedZone !== null);

  const applyZone = (zone: StagingZone) => {
    if (!onSetPlayerStagingZone) return;
    // Show what was sent, including a view-derived zone.
    setStagingInputs(stagingInputsFrom(zone));
    onSetPlayerStagingZone(zone);
  };

  const handleStagingZoneApply = () => {
    const zone = firstZoneFromView ? viewportZone(camera, gridSize) : typedZone;
    if (zone) applyZone(zone);
  };

  const handleCenterOnView = () => {
    if (typedShape) applyZone({ ...viewCenter(camera, gridSize), ...typedShape });
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
              <StagingField
                label="Center X"
                value={stagingInputs.x}
                onChange={(value) => handleStagingInputChange("x", value)}
                step={0.1}
              />
              <StagingField
                label="Center Y"
                value={stagingInputs.y}
                onChange={(value) => handleStagingInputChange("y", value)}
                step={0.1}
              />
              <StagingField
                label="Width (tiles)"
                value={stagingInputs.width}
                onChange={(value) => handleStagingInputChange("width", value)}
                step={0.5}
                min={MIN_STAGING_SIZE}
              />
              <StagingField
                label="Height (tiles)"
                value={stagingInputs.height}
                onChange={(value) => handleStagingInputChange("height", value)}
                step={0.5}
                min={MIN_STAGING_SIZE}
              />
            </div>
            <StagingField
              label="Rotation (degrees)"
              value={stagingInputs.rotation}
              onChange={(value) => handleStagingInputChange("rotation", value)}
              step={1}
            />
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <JRPGButton
                onClick={handleStagingZoneApply}
                variant="primary"
                style={{ fontSize: "10px", flex: "1 1 auto" }}
                disabled={!canApply}
              >
                Apply Zone
              </JRPGButton>
              <JRPGButton
                onClick={handleCenterOnView}
                variant="default"
                style={{ fontSize: "10px", flex: "1 1 auto" }}
                disabled={!onSetPlayerStagingZone || typedShape === null}
                title="Move the zone's centre to the middle of your screen, keeping its size and rotation"
              >
                Center on view
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
            {!canApply && onSetPlayerStagingZone && (
              <span role="status" className="jrpg-text-tiny" style={{ color: "var(--jrpg-red)" }}>
                Every field needs a number, and width and height at least {MIN_STAGING_SIZE}.
              </span>
            )}
            <span className="jrpg-text-tiny" style={{ color: "var(--jrpg-white)", opacity: 0.6 }}>
              &ldquo;Apply Zone&rdquo; creates or updates the staging zone at the numbers above, in
              tiles; with no zone yet and nothing typed, it goes in the middle of your screen. Use
              the Transform tool to move and resize it on the map. Players spawn randomly within
              this area.
            </span>
          </div>
        </CollapsibleSection>
      </div>
    </JRPGPanel>
  );
}
