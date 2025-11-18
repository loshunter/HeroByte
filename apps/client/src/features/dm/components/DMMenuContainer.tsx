/**
 * DMMenuContainer Component
 *
 * Container component that wraps DMMenu and provides DM-specific state/actions.
 * This component instantiates all DM hooks (via useDMContext) and passes the
 * results to the presentational DMMenu component.
 *
 * Purpose: Enable lazy-loading of DM tooling by deferring hook instantiation
 * until this component loads (only when isDM is true).
 *
 * @module features/dm/components/DMMenuContainer
 */

import React from "react";
import type { RoomSnapshot, ClientMessage, PlayerStagingZone } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../types/alignment";
import type { Camera } from "../../../hooks/useCamera";
import { useDMContext, type UseDMContextOptions } from "../hooks/useDMContext";
import { DMMenu } from "./DMMenu";

interface DMMenuContainerProps {
  // DM Status
  isDM: boolean;
  onToggleDM: (next: boolean) => void;

  // Grid
  gridSize: number;
  gridSquareSize?: number;
  gridLocked: boolean;
  onGridLockToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange?: (size: number) => void;

  // Map
  onClearDrawings: () => void;
  onSetMapBackground: (url: string) => void;
  mapBackground?: string;
  mapLocked?: boolean;
  onMapLockToggle?: () => void;
  mapTransform?: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
  onMapTransformChange?: (
    transform: Partial<{ x: number; y: number; scaleX: number; scaleY: number; rotation: number }>,
  ) => void;

  // Staging Zone
  playerStagingZone?: PlayerStagingZone;
  onSetPlayerStagingZone?: (zone: PlayerStagingZone | undefined) => void;
  stagingZoneLocked?: boolean;
  onStagingZoneLockToggle?: () => void;

  // Alignment
  alignmentModeActive: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  alignmentError?: string | null;
  onAlignmentStart: () => void;
  onAlignmentReset: () => void;
  onAlignmentCancel: () => void;
  onAlignmentApply: () => void;

  // Room Password
  onSetRoomPassword?: (secret: string) => void;
  roomPasswordStatus?: { type: "success" | "error"; message: string } | null;
  roomPasswordPending?: boolean;
  onDismissRoomPasswordStatus?: () => void;

  // Raw dependencies for useDMContext
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  camera: Camera;
  toast: {
    info: (message: string, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
  };

  // Other actions
  onSelectPlayerTokens: (playerUid: string) => void;
  onSetInitiative?: (characterId: string, initiative: number, modifier: number) => void;
}

/**
 * Container component for DMMenu.
 *
 * This component:
 * 1. Instantiates useDMContext to get all DM-specific hooks/actions
 * 2. Extracts necessary data from snapshot (characters, props, players, etc.)
 * 3. Passes everything to the presentational DMMenu component
 *
 * By lazy-loading this container, we defer all DM hook instantiation until
 * the user becomes a DM, reducing bundle size for regular players.
 */
export function DMMenuContainer({
  isDM,
  onToggleDM,
  gridSize,
  gridSquareSize,
  gridLocked,
  onGridLockToggle,
  onGridSizeChange,
  onGridSquareSizeChange,
  onClearDrawings,
  onSetMapBackground,
  mapBackground,
  mapLocked,
  onMapLockToggle,
  mapTransform,
  onMapTransformChange,
  playerStagingZone,
  onSetPlayerStagingZone,
  stagingZoneLocked,
  onStagingZoneLockToggle,
  alignmentModeActive,
  alignmentPoints,
  alignmentSuggestion,
  alignmentError,
  onAlignmentStart,
  onAlignmentReset,
  onAlignmentCancel,
  onAlignmentApply,
  onSetRoomPassword,
  roomPasswordStatus,
  roomPasswordPending,
  onDismissRoomPasswordStatus,
  snapshot,
  sendMessage,
  camera,
  toast,
  onSelectPlayerTokens,
  onSetInitiative,
}: DMMenuContainerProps) {
  // Instantiate DM context with all DM-specific hooks
  const dmContext = useDMContext({
    snapshot,
    sendMessage,
    cameraState: camera,
    toast,
  } as UseDMContextOptions);

  // Extract data from snapshot
  const characters = snapshot?.characters || [];
  const props = snapshot?.props || [];
  const players = snapshot?.players || [];
  const sceneObjects = snapshot?.sceneObjects || [];
  const playerCount = snapshot?.players?.length ?? 0;
  const combatActive = snapshot?.combatActive ?? false;

  // Pass everything to presentational DMMenu
  return (
    <DMMenu
      isDM={isDM}
      onToggleDM={onToggleDM}
      gridSize={gridSize}
      gridSquareSize={gridSquareSize}
      gridLocked={gridLocked}
      onGridLockToggle={onGridLockToggle}
      onGridSizeChange={onGridSizeChange}
      onGridSquareSizeChange={onGridSquareSizeChange}
      onClearDrawings={onClearDrawings}
      onSetMapBackground={onSetMapBackground}
      onMapBackgroundSuccess={toast.success}
      onMapBackgroundError={toast.error}
      mapBackground={mapBackground}
      playerStagingZone={playerStagingZone}
      onSetPlayerStagingZone={onSetPlayerStagingZone}
      stagingZoneLocked={stagingZoneLocked}
      onStagingZoneLockToggle={onStagingZoneLockToggle}
      camera={camera}
      playerCount={playerCount}
      characters={characters}
      onRequestSaveSession={snapshot ? dmContext.sessionManagement.handleSaveSession : undefined}
      onRequestLoadSession={dmContext.sessionManagement.handleLoadSession}
      onCreateNPC={dmContext.npcManagement.createNpc}
      onUpdateNPC={dmContext.npcManagement.updateNpc}
      onDeleteNPC={dmContext.npcManagement.deleteNpc}
      onPlaceNPCToken={dmContext.npcManagement.placeToken}
      isCreatingNpc={dmContext.npcManagement.isCreating}
      npcCreationError={dmContext.npcManagement.creationError}
      isUpdatingNpc={dmContext.npcManagement.isUpdating}
      npcUpdateError={dmContext.npcManagement.updateError}
      updatingNpcId={dmContext.npcManagement.updatingNpcId}
      isPlacingToken={dmContext.npcManagement.isPlacing}
      tokenPlacementError={dmContext.npcManagement.tokenPlacementError}
      placingTokenForNpcId={dmContext.npcManagement.placingTokenForNpcId}
      props={props}
      players={players}
      onCreateProp={dmContext.propManagement.createProp}
      onUpdateProp={dmContext.propManagement.updateProp}
      onDeleteProp={dmContext.propManagement.deleteProp}
      isCreatingProp={dmContext.propManagement.isCreating}
      propCreationError={dmContext.propManagement.creationError}
      isDeletingProp={dmContext.propManagement.isDeleting}
      deletingPropId={dmContext.propManagement.deletingPropId}
      propDeletionError={dmContext.propManagement.deletionError}
      isUpdatingProp={dmContext.propManagement.isUpdating}
      propUpdateError={dmContext.propManagement.updateError}
      updatingPropId={dmContext.propManagement.updatingPropId}
      mapLocked={mapLocked}
      onMapLockToggle={onMapLockToggle}
      mapTransform={mapTransform}
      onMapTransformChange={onMapTransformChange}
      alignmentModeActive={alignmentModeActive}
      alignmentPoints={alignmentPoints}
      alignmentSuggestion={alignmentSuggestion}
      alignmentError={alignmentError}
      onAlignmentStart={onAlignmentStart}
      onAlignmentReset={onAlignmentReset}
      onAlignmentCancel={onAlignmentCancel}
      onAlignmentApply={onAlignmentApply}
      onSetRoomPassword={onSetRoomPassword}
      roomPasswordStatus={roomPasswordStatus}
      roomPasswordPending={roomPasswordPending}
      onDismissRoomPasswordStatus={onDismissRoomPasswordStatus}
      sceneObjects={sceneObjects}
      onSelectPlayerTokens={onSelectPlayerTokens}
      combatActive={combatActive}
      onStartCombat={dmContext.combatControls.handleStartCombat}
      onEndCombat={dmContext.combatControls.handleEndCombat}
      onClearAllInitiative={dmContext.combatControls.handleClearAllInitiative}
      onNextTurn={dmContext.combatControls.handleNextTurn}
      onPreviousTurn={dmContext.combatControls.handlePreviousTurn}
      toast={toast}
      onSetInitiative={onSetInitiative}
    />
  );
}
