/**
 * FloatingPanelsLayout Component
 *
 * Renders floating UI panels and overlays that appear above the main canvas:
 * DM menu, context menu, visual effects, dice roller, roll log, and toasts.
 *
 * Part of Phase 15 SOLID Refactor - MainLayout Decomposition
 * Extracted from: MainLayout.tsx lines 663-774
 *
 * @remarks Pure presentation component with no internal state.
 */

import React from "react";
import type { RoomSnapshot, PlayerStagingZone, Character } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import type { RollResult } from "../components/dice/types";
import type { PropUpdate } from "../hooks/usePropManagement";
import { DMMenu } from "../features/dm";
import { ContextMenu } from "../components/ui/ContextMenu";
import { VisualEffects } from "../components/effects/VisualEffects";
import { DiceRoller } from "../components/dice/DiceRoller";
import { RollLog } from "../components/dice/RollLog";
import { ToastContainer } from "../components/ui/Toast";
import type { ToastMessage } from "../components/ui/Toast";

type Camera = { x: number; y: number; scale: number };
type ContextMenuState = { x: number; y: number; tokenId: string } | null;
type PasswordStatus = { type: "success" | "error"; message: string } | null;
type SceneObject = { id: string; locked: boolean; transform?: Transform };
type Transform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number };

export interface RollLogEntry extends RollResult {
  playerName: string;
}

/**
 * Props for FloatingPanelsLayout
 * Groups: DM/Context(4), Grid(5), Controls(4), Scene(7), Alignment(8),
 * Session(2), NPC(4), Prop(3), Password(4), Dice(3), RollLog(6), Effects(1), Toast(1)
 */
export interface FloatingPanelsLayoutProps {
  // DM Status & Context Menu (4)
  isDM: boolean;
  contextMenu: ContextMenuState | null;
  deleteToken: (id: string) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  // Grid State & Handlers (5)
  gridSize: number;
  gridSquareSize: number;
  gridLocked: boolean;
  onGridSizeChange: (size: number) => void;
  onGridSquareSizeChange: (size: number) => void;
  // DM Mode & Controls (4)
  onToggleDM: (next: boolean) => void;
  onGridLockToggle: () => void;
  onClearDrawings: () => void;
  camera: Camera;
  // Scene Objects & Map (7)
  snapshot: RoomSnapshot | null;
  mapSceneObject: SceneObject | null;
  stagingZoneSceneObject: SceneObject | null;
  onSetMapBackground: (url: string) => void;
  toggleSceneObjectLock: (id: string, locked: boolean) => void;
  transformSceneObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  onSetPlayerStagingZone: (zone: PlayerStagingZone | undefined) => void;
  // Alignment Mode (8)
  alignmentMode: boolean;
  alignmentPoints: AlignmentPoint[];
  alignmentSuggestion: AlignmentSuggestion | null;
  alignmentError: string | null;
  onAlignmentStart: () => void;
  onAlignmentReset: () => void;
  onAlignmentCancel: () => void;
  onAlignmentApply: () => void;
  // Session Management (2)
  onRequestSaveSession: ((sessionName: string) => void) | undefined;
  onRequestLoadSession: ((file: File) => void) | undefined;
  // NPC Management (12)
  onCreateNPC: () => void;
  onUpdateNPC: (id: string, updates: Partial<Character>) => void;
  onDeleteNPC: (id: string) => void;
  onPlaceNPCToken: (npcId: string) => void;
  isCreatingNpc?: boolean;
  npcCreationError?: string | null;
  isUpdatingNpc?: boolean;
  npcUpdateError?: string | null;
  updatingNpcId?: string | null;
  isPlacingToken?: boolean;
  tokenPlacementError?: string | null;
  placingTokenForNpcId?: string | null;
  // Prop Management (8)
  onCreateProp: () => void;
  onUpdateProp: (id: string, updates: PropUpdate) => void;
  onDeleteProp: (id: string) => void;
  isCreatingProp?: boolean;
  propCreationError?: string | null;
  isDeletingProp?: boolean;
  deletingPropId?: string | null;
  propDeletionError?: string | null;
  isUpdatingProp?: boolean;
  propUpdateError?: string | null;
  updatingPropId?: string | null;
  // Room Password (4)
  onSetRoomPassword: (password: string) => void;
  roomPasswordStatus: PasswordStatus | null;
  roomPasswordPending: boolean;
  onDismissRoomPasswordStatus: () => void;
  // Dice Roller (3)
  diceRollerOpen: boolean;
  toggleDiceRoller: (open: boolean) => void;
  handleRoll: (roll: RollResult) => void;
  // Roll Log (6)
  rollLogOpen: boolean;
  rollHistory: RollLogEntry[];
  viewingRoll: RollLogEntry | null;
  toggleRollLog: (open: boolean) => void;
  handleClearLog: () => void;
  handleViewRoll: (roll: RollLogEntry | null) => void;
  // Visual Effects (1)
  crtFilter: boolean;
  // Toast Messages (1)
  toast: {
    messages: ToastMessage[];
    dismiss: (id: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
  };
  // Player Token Selection (DM shortcut) (1)
  selectPlayerTokens: (playerUid: string) => void;
  // Combat Controls (6)
  combatActive?: boolean;
  onStartCombat?: () => void;
  onEndCombat?: () => void;
  onClearAllInitiative?: () => void;
  onNextTurn?: () => void;
  onPreviousTurn?: () => void;
}

/**
 * FloatingPanelsLayout - Renders floating UI panels and overlays
 */
export const FloatingPanelsLayout = React.memo<FloatingPanelsLayoutProps>(
  ({
    isDM,
    contextMenu,
    deleteToken,
    setContextMenu,
    gridSize,
    gridSquareSize,
    gridLocked,
    onGridSizeChange,
    onGridSquareSizeChange,
    onToggleDM,
    onGridLockToggle,
    onClearDrawings,
    camera,
    snapshot,
    mapSceneObject,
    stagingZoneSceneObject,
    onSetMapBackground,
    toggleSceneObjectLock,
    transformSceneObject,
    onSetPlayerStagingZone,
    alignmentMode,
    alignmentPoints,
    alignmentSuggestion,
    alignmentError,
    onAlignmentStart,
    onAlignmentReset,
    onAlignmentCancel,
    onAlignmentApply,
    onRequestSaveSession,
    onRequestLoadSession,
    onCreateNPC,
    onUpdateNPC,
    onDeleteNPC,
    onPlaceNPCToken,
    isCreatingNpc,
    npcCreationError,
    isUpdatingNpc,
    npcUpdateError,
    updatingNpcId,
    isPlacingToken,
    tokenPlacementError,
    placingTokenForNpcId,
    onCreateProp,
    onUpdateProp,
    onDeleteProp,
    isCreatingProp,
    propCreationError,
    isDeletingProp,
    deletingPropId,
    propDeletionError,
    isUpdatingProp,
    propUpdateError,
    updatingPropId,
    onSetRoomPassword,
    roomPasswordStatus,
    roomPasswordPending,
    onDismissRoomPasswordStatus,
    diceRollerOpen,
    toggleDiceRoller,
    handleRoll,
    rollLogOpen,
    rollHistory,
    viewingRoll,
    toggleRollLog,
    handleClearLog,
    handleViewRoll,
    crtFilter,
    toast,
    selectPlayerTokens,
    combatActive,
    onStartCombat,
    onEndCombat,
    onClearAllInitiative,
    onNextTurn,
    onPreviousTurn,
  }) => {
    return (
      <>
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
          mapBackground={snapshot?.mapBackground}
          playerStagingZone={snapshot?.playerStagingZone}
          onSetPlayerStagingZone={onSetPlayerStagingZone}
          camera={camera}
          playerCount={snapshot?.players?.length ?? 0}
          characters={snapshot?.characters || []}
          onRequestSaveSession={snapshot ? onRequestSaveSession : undefined}
          onRequestLoadSession={onRequestLoadSession}
          onCreateNPC={onCreateNPC}
          onUpdateNPC={onUpdateNPC}
          onDeleteNPC={onDeleteNPC}
          onPlaceNPCToken={onPlaceNPCToken}
          isCreatingNpc={isCreatingNpc}
          npcCreationError={npcCreationError}
          isUpdatingNpc={isUpdatingNpc}
          npcUpdateError={npcUpdateError}
          updatingNpcId={updatingNpcId}
          isPlacingToken={isPlacingToken}
          tokenPlacementError={tokenPlacementError}
          placingTokenForNpcId={placingTokenForNpcId}
          props={snapshot?.props || []}
          players={snapshot?.players || []}
          onCreateProp={onCreateProp}
          onUpdateProp={onUpdateProp}
          onDeleteProp={onDeleteProp}
          isCreatingProp={isCreatingProp}
          propCreationError={propCreationError}
          isDeletingProp={isDeletingProp}
          deletingPropId={deletingPropId}
          propDeletionError={propDeletionError}
          isUpdatingProp={isUpdatingProp}
          propUpdateError={propUpdateError}
          updatingPropId={updatingPropId}
          mapLocked={mapSceneObject?.locked ?? true}
          onMapLockToggle={() => {
            if (mapSceneObject) {
              toggleSceneObjectLock(mapSceneObject.id, !mapSceneObject.locked);
            }
          }}
          stagingZoneLocked={stagingZoneSceneObject?.locked ?? false}
          onStagingZoneLockToggle={() => {
            if (stagingZoneSceneObject) {
              toggleSceneObjectLock(stagingZoneSceneObject.id, !stagingZoneSceneObject.locked);
            }
          }}
          mapTransform={
            mapSceneObject?.transform ?? {
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              rotation: 0,
            }
          }
          onMapTransformChange={(transform) => {
            if (mapSceneObject) {
              transformSceneObject({
                id: mapSceneObject.id,
                ...(transform.x !== undefined && transform.y !== undefined
                  ? { position: { x: transform.x, y: transform.y } }
                  : {}),
                ...(transform.scaleX !== undefined && transform.scaleY !== undefined
                  ? { scale: { x: transform.scaleX, y: transform.scaleY } }
                  : {}),
                ...(transform.rotation !== undefined ? { rotation: transform.rotation } : {}),
              });
            }
          }}
          alignmentModeActive={alignmentMode}
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
          sceneObjects={snapshot?.sceneObjects || []}
          onSelectPlayerTokens={selectPlayerTokens}
          combatActive={combatActive}
          onStartCombat={onStartCombat}
          onEndCombat={onEndCombat}
          onClearAllInitiative={onClearAllInitiative}
          onNextTurn={onNextTurn}
          onPreviousTurn={onPreviousTurn}
        />

        <ContextMenu
          menu={contextMenu}
          onDelete={deleteToken}
          onClose={() => setContextMenu(null)}
        />

        <VisualEffects crtFilter={crtFilter} />

        {diceRollerOpen && (
          <DiceRoller onRoll={handleRoll} onClose={() => toggleDiceRoller(false)} />
        )}

        {rollLogOpen && (
          <div
            style={{
              position: "fixed",
              right: 20,
              top: 200,
              width: 350,
              height: 500,
              zIndex: 1000,
            }}
          >
            <RollLog
              rolls={rollHistory}
              onClearLog={handleClearLog}
              onViewRoll={(roll) => handleViewRoll(roll)}
              onClose={() => toggleRollLog(false)}
            />
          </div>
        )}

        {viewingRoll && (
          <div style={{ position: "fixed", zIndex: 2000 }}>
            <DiceRoller onRoll={() => {}} onClose={() => handleViewRoll(null)} />
          </div>
        )}

        <ToastContainer messages={toast.messages} onDismiss={toast.dismiss} />
      </>
    );
  },
);

FloatingPanelsLayout.displayName = "FloatingPanelsLayout";
