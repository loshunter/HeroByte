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

import React, { Suspense, lazy } from "react";
import type { RoomSnapshot, PlayerStagingZone, ClientMessage, ChatMessage } from "@herobyte/shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import type { RollLogEntry } from "../components/dice/rollLogTypes";
import type { DiceRollRequest } from "../hooks/useDiceRolling";
import { ContextMenu } from "../components/ui/ContextMenu";
import { VisualEffects } from "../components/effects/VisualEffects";
import { DicePanels } from "./DicePanels";
import { ToastContainer } from "../components/ui/Toast";
import { Spinner } from "../components/ui/Spinner";
import type { ToastMessage } from "../components/ui/Toast";
import type { MapStudioController } from "../features/map-studio";

// Lazy-load DMMenuContainer to defer DM-specific code until DM elevation
const DMMenuContainer = lazy(() =>
  import("../features/dm/lazy-entry").then((mod) => ({ default: mod.DMMenuContainer })),
);

type Camera = { x: number; y: number; scale: number };
type ContextMenuState = { x: number; y: number; tokenId: string } | null;
type PasswordStatus = { type: "success" | "error"; message: string } | null;
type SceneObject = { id: string; locked: boolean; transform?: Transform };
type Transform = { x: number; y: number; scaleX: number; scaleY: number; rotation: number };

// RollLogEntry lives in components/dice/rollLogTypes and is re-exported here
// for the layouts that already import it from this module. It was a THIRD
// declaration of the same name (the hook had one too); they disagreed about
// whether `formula` existed, which is what let the roll log render a blank
// formula line while the string sat unread on the object.
export type { RollLogEntry };

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
  // WebSocket Communication (1)
  // Note: sendMessage is now passed to DMMenuContainer which handles all DM hooks internally
  sendMessage: (message: ClientMessage) => void;
  // Room Password (4)
  onSetRoomPassword: (password?: string) => void;
  onSaveAsPrivateTable?: (input: {
    name: string;
    roomPassword: string;
    dmPassword?: string;
  }) => Promise<void>;
  roomPasswordStatus: PasswordStatus | null;
  roomPasswordPending: boolean;
  onDismissRoomPasswordStatus: () => void;
  // Dice Roller (3)
  diceRollerOpen: boolean;
  toggleDiceRoller: (open: boolean) => void;
  handleRoll: (request: DiceRollRequest) => void;
  /** Newest roll authored by this player — how the roller learns its result. */
  latestOwnRoll: RollLogEntry | null;
  // Roll Log (6)
  rollLogOpen: boolean;
  rollHistory: RollLogEntry[];
  chatMessages: ChatMessage[];
  handleSendChat: (text: string, to?: string) => void;
  /** Local player's uid — chat styles your own lines and excludes you as a whisper target. */
  uid: string;
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
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
  // Player Token Selection (DM shortcut) (1)
  selectPlayerTokens: (playerUid: string) => void;
  // Initiative Management (1)
  onSetInitiative?: (characterId: string, initiative: number, modifier: number) => void;
  mapStudio?: MapStudioController;
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
    sendMessage,
    onSetRoomPassword,
    onSaveAsPrivateTable,
    roomPasswordStatus,
    roomPasswordPending,
    onDismissRoomPasswordStatus,
    diceRollerOpen,
    toggleDiceRoller,
    handleRoll,
    latestOwnRoll,
    rollLogOpen,
    rollHistory,
    chatMessages,
    handleSendChat,
    uid,
    viewingRoll,
    toggleRollLog,
    handleClearLog,
    handleViewRoll,
    crtFilter,
    toast,
    selectPlayerTokens,
    onSetInitiative,
    mapStudio,
  }) => {
    return (
      <>
        {isDM && (
          // Not `null`: elevating to DM fires a success toast and then, while
          // the chunk downloads, nothing visible happens at all — which reads
          // as the elevation having failed.
          <Suspense
            fallback={
              <div
                style={{
                  position: "fixed",
                  right: "16px",
                  bottom: "16px",
                  zIndex: 1002,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  background: "var(--jrpg-bg)",
                  border: "2px solid var(--jrpg-border)",
                  borderRadius: "4px",
                  color: "var(--jrpg-text)",
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                }}
              >
                <Spinner size={14} />
                Loading DM tools…
              </div>
            }
          >
            <DMMenuContainer
              isDM={isDM}
              onToggleDM={onToggleDM}
              gridSize={gridSize}
              gridSquareSize={gridSquareSize}
              gridLocked={gridLocked}
              onGridLockToggle={onGridLockToggle}
              onGridSizeChange={onGridSizeChange}
              onGridSquareSizeChange={onGridSquareSizeChange}
              fogEnabled={snapshot?.fogEnabled ?? false}
              hasCompiledScene={Boolean(snapshot?.compiledScene)}
              onFogEnabledChange={(enabled) => sendMessage({ t: "set-fog-enabled", enabled })}
              onClearDrawings={onClearDrawings}
              onSetMapBackground={onSetMapBackground}
              mapBackground={snapshot?.mapBackground}
              playerStagingZone={snapshot?.playerStagingZone}
              onSetPlayerStagingZone={onSetPlayerStagingZone}
              camera={camera}
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
              onSaveAsPrivateTable={onSaveAsPrivateTable}
              roomPasswordStatus={roomPasswordStatus}
              roomPasswordPending={roomPasswordPending}
              onDismissRoomPasswordStatus={onDismissRoomPasswordStatus}
              snapshot={snapshot}
              sendMessage={sendMessage}
              toast={toast}
              onSelectPlayerTokens={selectPlayerTokens}
              onSetInitiative={onSetInitiative}
              mapStudio={mapStudio}
            />
          </Suspense>
        )}

        <ContextMenu
          menu={contextMenu}
          onDelete={deleteToken}
          onClose={() => setContextMenu(null)}
        />

        <VisualEffects crtFilter={crtFilter} />

        <DicePanels
          diceRollerOpen={diceRollerOpen}
          toggleDiceRoller={toggleDiceRoller}
          handleRoll={handleRoll}
          latestOwnRoll={latestOwnRoll}
          rollLogOpen={rollLogOpen}
          toggleRollLog={toggleRollLog}
          rollHistory={rollHistory}
          handleClearLog={handleClearLog}
          viewingRoll={viewingRoll}
          handleViewRoll={handleViewRoll}
          chatMessages={chatMessages}
          players={snapshot?.players ?? []}
          uid={uid}
          handleSendChat={handleSendChat}
          isDM={isDM}
        />

        <ToastContainer messages={toast.messages} onDismiss={toast.dismiss} />
      </>
    );
  },
);

FloatingPanelsLayout.displayName = "FloatingPanelsLayout";
