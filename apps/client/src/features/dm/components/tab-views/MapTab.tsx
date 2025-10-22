// ============================================================================
// MAP TAB COMPONENT
// ============================================================================
// Composition component for the Map Setup tab in the DM Menu.
//
// This component orchestrates the map configuration workflow by arranging
// specialized control components in a vertical layout. It handles:
//
// 1. Map Background - Upload/set the background image
// 2. Map Transform - Adjust position, scale, and rotation (conditional)
// 3. Grid Control - Configure grid size and square dimensions
// 4. Grid Alignment - Align grid to map features using visual wizard
// 5. Staging Zone - Define player spawn area
// 6. Drawing Controls - Clear session drawings
//
// This is purely a composition component - it does not contain business logic,
// only arranges child components and passes through their props.

import type { PlayerStagingZone } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../../types/alignment";
import type { Camera } from "../../../../hooks/useCamera";
import { MapBackgroundControl } from "../map-controls/MapBackgroundControl";
import { MapTransformControl } from "../map-controls/MapTransformControl";
import { GridControl } from "../map-controls/GridControl";
import { GridAlignmentWizard } from "../map-controls/GridAlignmentWizard";
import { StagingZoneControl } from "../map-controls/StagingZoneControl";
import { DrawingControls } from "../map-controls/DrawingControls";

/**
 * Props for the MapTab component.
 *
 * All props are pass-through values for child control components.
 * Props are grouped by the component they're destined for.
 */
export interface MapTabProps {
  // MapBackgroundControl props
  mapBackground?: string;
  onSetMapBackground: (url: string) => void;

  // MapTransformControl props (conditional rendering)
  mapTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  mapLocked?: boolean;
  onMapTransformChange?: (
    transform: Partial<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  ) => void;
  onMapLockToggle?: () => void;

  // GridControl props
  gridSize: number;
  gridSquareSize?: number;
  gridLocked: boolean;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange?: (size: number) => void;
  onGridLockToggle: () => void;

  // GridAlignmentWizard props
  alignmentModeActive: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  alignmentError?: string | null;
  onAlignmentStart: () => void;
  onAlignmentReset: () => void;
  onAlignmentCancel: () => void;
  onAlignmentApply: () => void;

  // StagingZoneControl props
  playerStagingZone?: PlayerStagingZone;
  camera: Camera;
  stagingZoneLocked?: boolean;
  onStagingZoneLockToggle?: () => void;
  onSetPlayerStagingZone?: (zone: PlayerStagingZone | undefined) => void;

  // DrawingControls props
  onClearDrawings: () => void;
}

/**
 * MapTab - Map Setup tab view for DM Menu.
 *
 * Renders a vertical stack of map configuration controls with consistent
 * spacing. The MapTransformControl is conditionally rendered only when
 * the necessary props and handlers are provided.
 *
 * @param props - All props required by child control components
 * @returns A flexbox column layout containing all map controls
 */
export default function MapTab({
  mapBackground,
  onSetMapBackground,
  mapTransform,
  mapLocked,
  onMapTransformChange,
  onMapLockToggle,
  gridSize,
  gridSquareSize,
  gridLocked,
  onGridSizeChange,
  onGridSquareSizeChange,
  onGridLockToggle,
  alignmentModeActive,
  alignmentPoints,
  alignmentSuggestion,
  alignmentError,
  onAlignmentStart,
  onAlignmentReset,
  onAlignmentCancel,
  onAlignmentApply,
  playerStagingZone,
  camera,
  stagingZoneLocked,
  onStagingZoneLockToggle,
  onSetPlayerStagingZone,
  onClearDrawings,
}: MapTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <MapBackgroundControl mapBackground={mapBackground} onSetMapBackground={onSetMapBackground} />

      {/* Step 2: Adjust Map Transform (scale, position, rotation) */}
      {onMapLockToggle && onMapTransformChange && mapTransform && (
        <MapTransformControl
          mapTransform={mapTransform}
          mapLocked={mapLocked ?? false}
          onMapTransformChange={onMapTransformChange}
          onMapLockToggle={onMapLockToggle}
        />
      )}

      <GridControl
        gridSize={gridSize}
        gridSquareSize={gridSquareSize}
        gridLocked={gridLocked}
        onGridSizeChange={onGridSizeChange}
        onGridSquareSizeChange={onGridSquareSizeChange}
        onGridLockToggle={onGridLockToggle}
      />

      {/* Step 4: Align Grid to Map (optional) */}
      <GridAlignmentWizard
        alignmentModeActive={alignmentModeActive}
        alignmentPoints={alignmentPoints}
        alignmentSuggestion={alignmentSuggestion}
        alignmentError={alignmentError}
        gridLocked={gridLocked}
        mapLocked={mapLocked}
        onAlignmentStart={onAlignmentStart}
        onAlignmentReset={onAlignmentReset}
        onAlignmentCancel={onAlignmentCancel}
        onAlignmentApply={onAlignmentApply}
      />

      {/* Step 5: Define Player Spawn Area */}
      <StagingZoneControl
        playerStagingZone={playerStagingZone}
        camera={camera}
        gridSize={gridSize}
        stagingZoneLocked={stagingZoneLocked ?? false}
        onStagingZoneLockToggle={onStagingZoneLockToggle}
        onSetPlayerStagingZone={onSetPlayerStagingZone}
      />

      {/* Step 6: Session Cleanup */}
      <DrawingControls onClearDrawings={onClearDrawings} />
    </div>
  );
}
