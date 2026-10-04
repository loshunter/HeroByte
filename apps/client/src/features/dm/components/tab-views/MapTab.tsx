// ============================================================================
// MAPS TAB COMPONENT
// ============================================================================
// The DM Menu's Maps tab (U6). Maps are three different things, and this tab
// names two of them apart (World is its own tab):
//
// 1. On table / Viewing in library — always shown, so a DM never mistakes the
//    saved map they are inspecting for the one the party is on.
// 2. Current table map — the settings of what the party sees now: background,
//    grid, fog, vision, staging zone and drawings, with map position and grid
//    alignment collapsed under Advanced.
// 3. Map library — saved maps; viewing one never moves the party.
//
// Composition only: it arranges child controls and passes their props through.

import { useEffect, useId, useState } from "react";
import type { AtlasNodeSnapshot, DiagonalRule, PlayerStagingZone } from "@herobyte/shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../../types/alignment";
import type { Camera } from "../../../../hooks/useCamera";
import { MapBackgroundControl } from "../map-controls/MapBackgroundControl";
import { MapTransformControl } from "../map-controls/MapTransformControl";
import { GridControl } from "../map-controls/GridControl";
import { FogControl } from "../map-controls/FogControl";
import { DefaultVisionControl } from "../map-controls/DefaultVisionControl";
import { GridAlignmentWizard } from "../map-controls/GridAlignmentWizard";
import { StagingZoneControl } from "../map-controls/StagingZoneControl";
import { DrawingControls } from "../map-controls/DrawingControls";
import { MapStudioControl } from "../map-controls/MapStudioControl";
import type { MapStudioController } from "../../../map-studio";
import { describeOnTable, displayName } from "../../../map-studio/tableMapIdentity";

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
  onMapBackgroundSuccess?: (message: string) => void;
  onMapBackgroundError?: (message: string) => void;

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
  diagonalRule?: DiagonalRule;
  onDiagonalRuleChange?: (rule: DiagonalRule) => void;

  // FogControl props
  fogEnabled?: boolean;
  hasCompiledScene?: boolean;
  onFogEnabledChange?: (enabled: boolean) => void;
  defaultVisionRadius?: number;
  onDefaultVisionRadiusChange?: (radiusFeet: number | null) => void;

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
  mapStudio?: MapStudioController;
  /** What "the live map" means to PUBLISH: the compiled scene's source document. */
  liveSceneDocumentId?: string;
  /** The room's live binding: the saved map the party is on, and Build edits. */
  tableMapDocumentId?: string;
  /** Binds a library map to the table through the existing set-live transition. */
  onUseMapAtTable?: (documentId: string) => void;
  /** World locations, so a location's map can warn before Use at table or DELETE. */
  atlasNodes?: ReadonlyArray<Pick<AtlasNodeSnapshot, "name" | "mapDocumentId">>;
}

/** The Maps tab: what the party sees, its settings, and the saved-map library. */
export default function MapTab({
  mapBackground,
  onSetMapBackground,
  onMapBackgroundSuccess,
  onMapBackgroundError,
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
  diagonalRule,
  onDiagonalRuleChange,
  fogEnabled,
  hasCompiledScene,
  onFogEnabledChange,
  defaultVisionRadius,
  onDefaultVisionRadiusChange,
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
  mapStudio,
  liveSceneDocumentId,
  tableMapDocumentId,
  onUseMapAtTable,
  atlasNodes,
}: MapTabProps) {
  const headingId = useId();
  // Stays open once opened; also opens itself while an alignment is running,
  // so the wizard it holds is never hidden mid-alignment.
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Latch, don't just mirror: cancelling an alignment must not collapse the
  // wizard out from under the DM who pressed Cancel.
  useEffect(() => {
    if (alignmentModeActive) setAdvancedOpen(true);
  }, [alignmentModeActive]);
  const onTableName = describeOnTable({
    liveMapDocumentId: tableMapDocumentId,
    missingDocumentId: mapStudio?.missingDocumentId,
    sceneSourceDocumentId: liveSceneDocumentId,
    documents: mapStudio?.documents ?? [],
    hasCompiledScene: hasCompiledScene ?? false,
    hasBackground: Boolean(mapBackground),
  });
  const viewing = mapStudio?.activeDocument;
  // Unbound (an older save), the scene's own map is the one on the table.
  const viewingName =
    viewing && viewing.id !== (tableMapDocumentId ?? liveSceneDocumentId)
      ? (displayName(viewing.id, mapStudio?.documents ?? []) ?? viewing.name)
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="jrpg-text-small" data-testid="table-map-identity">
        <p style={{ margin: 0 }}>
          On table: <strong>{onTableName}</strong>
        </p>
        {viewingName && (
          <p style={{ margin: "2px 0 0" }}>
            Viewing in library: <strong>{viewingName}</strong>
          </p>
        )}
      </div>

      <section
        aria-labelledby={headingId}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <h3 id={headingId} style={{ margin: 0, fontSize: "12px", color: "var(--jrpg-gold)" }}>
          Current table map
        </h3>
        <MapBackgroundControl
          mapBackground={mapBackground}
          onSetMapBackground={onSetMapBackground}
          onSuccess={onMapBackgroundSuccess}
          onError={onMapBackgroundError}
        />
        <GridControl
          gridSize={gridSize}
          gridSquareSize={gridSquareSize}
          gridLocked={gridLocked}
          onGridSizeChange={onGridSizeChange}
          onGridSquareSizeChange={onGridSquareSizeChange}
          onGridLockToggle={onGridLockToggle}
          diagonalRule={diagonalRule}
          onDiagonalRuleChange={onDiagonalRuleChange}
        />
        {onFogEnabledChange && (
          <FogControl
            fogEnabled={fogEnabled ?? false}
            hasCompiledScene={hasCompiledScene ?? false}
            onFogEnabledChange={onFogEnabledChange}
          />
        )}
        {onDefaultVisionRadiusChange && (
          <DefaultVisionControl
            defaultVisionRadius={defaultVisionRadius}
            onDefaultVisionRadiusChange={onDefaultVisionRadiusChange}
            fogEnabled={fogEnabled ?? false}
          />
        )}
        <StagingZoneControl
          playerStagingZone={playerStagingZone}
          camera={camera}
          gridSize={gridSize}
          stagingZoneLocked={stagingZoneLocked ?? false}
          onStagingZoneLockToggle={onStagingZoneLockToggle}
          onSetPlayerStagingZone={onSetPlayerStagingZone}
        />
        <DrawingControls onClearDrawings={onClearDrawings} />
        <details
          open={advancedOpen || alignmentModeActive}
          onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
        >
          <summary className="jrpg-text-small">Advanced: map position and grid alignment</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            {onMapLockToggle && onMapTransformChange && mapTransform && (
              <MapTransformControl
                mapTransform={mapTransform}
                mapLocked={mapLocked ?? false}
                onMapTransformChange={onMapTransformChange}
                onMapLockToggle={onMapLockToggle}
              />
            )}
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
          </div>
        </details>
      </section>

      {mapStudio && (
        <MapStudioControl
          controller={mapStudio}
          liveSceneDocumentId={liveSceneDocumentId}
          tableMapDocumentId={tableMapDocumentId}
          hasBackground={Boolean(mapBackground)}
          fogEnabled={fogEnabled ?? false}
          atlasNodes={atlasNodes}
          onUseAtTable={onUseMapAtTable}
          onPublishToLiveMap={({ backgroundUrl, documentId, documentName, backgroundMode }) => {
            // Server-authoritative publish: compiles walls/doors/lights and
            // syncs background + grid in one atomic message. Passing the id +
            // elements-only mode makes the server attach painted terrain as data
            // (R5) so live terrain also appears when publishing from the DM menu.
            // False when nothing was sent (another map opened mid-bake).
            if (!mapStudio.publishDocument(backgroundUrl, documentId, backgroundMode)) return false;
            const name = displayName(documentId, mapStudio.documents) ?? documentName;
            onMapBackgroundSuccess?.(`Published "${name}" as the table's map background.`);
            return true;
          }}
        />
      )}
    </div>
  );
}
