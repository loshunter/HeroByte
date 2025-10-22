/**
 * MainLayout Props Interface
 *
 * Type definitions for the MainLayout component props.
 * This file contains the complete interface definition for all props needed
 * to render the main application layout.
 *
 * Extracted from MainLayout.tsx as part of Phase 15 SOLID Refactor Initiative
 * to improve code organization and maintainability.
 *
 * @module layouts/props/MainLayoutProps
 */

import type React from "react";
import type { Camera } from "../../hooks/useCamera";
import type {
  RoomSnapshot,
  ClientMessage,
  SceneObjectTransform,
  TokenSize,
  PlayerState,
  PlayerStagingZone,
  Character,
} from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../../types/alignment";
import type { RollResult } from "../../components/dice/types";
import type { UseDrawingStateManagerReturn } from "../../hooks/useDrawingStateManager";
import type { ToolMode } from "../../components/layout/Header";
import type { CameraCommand } from "../../ui/MapBoard";
import type { PropUpdate } from "../../hooks/usePropManagement";

// ============================================================================
// Type Aliases
// ============================================================================

/** Context menu state with position and target token */
export type ContextMenuState = { x: number; y: number; tokenId: string } | null;

/** Drawing toolbar props from drawing state manager */
export type DrawingToolbarProps = UseDrawingStateManagerReturn["toolbarProps"];

/** Drawing board props from drawing state manager */
export type DrawingBoardProps = UseDrawingStateManagerReturn["drawingProps"];

/** Toast notification state */
export type ToastState = ReturnType<typeof import("../../hooks/useToast").useToast>;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Roll log entry interface
 * This extends RollResult with playerName to match what RollLog.tsx expects
 */
export interface RollLogEntry extends RollResult {
  playerName: string;
}

/**
 * Props for the MainLayout component
 *
 * This interface defines all the props needed to render the complete application
 * layout. Props are organized into logical groups for clarity.
 */
export interface MainLayoutProps {
  // -------------------------------------------------------------------------
  // Layout State
  // -------------------------------------------------------------------------
  /** Height of the top panel in pixels */
  topHeight: number;
  /** Height of the bottom panel in pixels */
  bottomHeight: number;
  /** Reference to the top panel DOM element */
  topPanelRef: React.RefObject<HTMLDivElement>;
  /** Reference to the bottom panel DOM element */
  bottomPanelRef: React.RefObject<HTMLDivElement>;
  /** Context menu state (position and target token) */
  contextMenu: ContextMenuState;
  /** Handler to update context menu state */
  setContextMenu: (menu: ContextMenuState) => void;

  // -------------------------------------------------------------------------
  // Connection State
  // -------------------------------------------------------------------------
  /** Whether the WebSocket connection is active */
  isConnected: boolean;

  // -------------------------------------------------------------------------
  // Tool State
  // -------------------------------------------------------------------------
  /** Currently active tool mode */
  activeTool: ToolMode;
  /** Handler to change the active tool */
  setActiveTool: (mode: ToolMode) => void;
  /** Whether draw mode is active */
  drawMode: boolean;
  /** Whether pointer mode is active */
  pointerMode: boolean;
  /** Whether measure mode is active */
  measureMode: boolean;
  /** Whether transform mode is active */
  transformMode: boolean;
  /** Whether select mode is active */
  selectMode: boolean;
  /** Whether alignment mode is active */
  alignmentMode: boolean;

  // -------------------------------------------------------------------------
  // UI State
  // -------------------------------------------------------------------------
  /** Whether snap-to-grid is enabled */
  snapToGrid: boolean;
  /** Handler to update snap-to-grid state */
  setSnapToGrid: (value: boolean) => void;
  /** Whether CRT filter is enabled */
  crtFilter: boolean;
  /** Handler to update CRT filter state */
  setCrtFilter: (value: boolean) => void;
  /** Whether dice roller panel is open */
  diceRollerOpen: boolean;
  /** Whether roll log panel is open */
  rollLogOpen: boolean;
  /** Handler to toggle dice roller panel */
  toggleDiceRoller: (value: boolean) => void;
  /** Handler to toggle roll log panel */
  toggleRollLog: (value: boolean) => void;
  /** Whether microphone is enabled */
  micEnabled: boolean;
  /** Handler to toggle microphone */
  toggleMic: () => void;
  /** Whether the grid is locked */
  gridLocked: boolean;
  /** Handler to toggle grid lock */
  setGridLocked: React.Dispatch<React.SetStateAction<boolean>>;

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------
  /** Current room state snapshot */
  snapshot: RoomSnapshot | null;
  /** Current user's UID */
  uid: string;
  /** Grid size (cells) */
  gridSize: number;
  /** Grid square size (feet per cell) */
  gridSquareSize: number;
  /** Whether current user is DM */
  isDM: boolean;

  // -------------------------------------------------------------------------
  // Camera
  // -------------------------------------------------------------------------
  /** Current camera state */
  cameraState: { x: number; y: number; scale: number };
  /** Camera object (legacy) */
  camera: Camera;
  /** Camera command to execute */
  cameraCommand: CameraCommand | null;
  /** Handler for when camera command is handled */
  handleCameraCommandHandled: () => void;
  /** Handler for camera state changes */
  setCameraState: (state: { x: number; y: number; scale: number }) => void;
  /** Handler to focus on self */
  handleFocusSelf: () => void;
  /** Handler to reset camera */
  handleResetCamera: () => void;

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------
  /** Drawing manager toolbar props */
  drawingToolbarProps: DrawingToolbarProps;
  /** Drawing manager drawing props */
  drawingProps: DrawingBoardProps;
  /** Handler to clear all drawings */
  handleClearDrawings: () => void;

  // -------------------------------------------------------------------------
  // Editing
  // -------------------------------------------------------------------------
  /** UID of player being name-edited */
  editingPlayerUID: string | null;
  /** Current name input value */
  nameInput: string;
  /** UID of character whose current HP is being edited */
  editingHpUID: string | null;
  /** Current HP input value */
  hpInput: string;
  /** UID of character whose max HP is being edited */
  editingMaxHpUID: string | null;
  /** Current max HP input value */
  maxHpInput: string;
  /** Handler to update name input */
  updateNameInput: (value: string) => void;
  /** Handler to start name edit */
  startNameEdit: (uid: string) => void;
  /** Handler to submit name edit */
  submitNameEdit: (callback: (name: string) => void) => void;
  /** Handler to update current HP input */
  updateHpInput: (value: string) => void;
  /** Handler to start current HP edit */
  startHpEdit: (uid: string) => void;
  /** Handler to submit current HP edit */
  submitHpEdit: (callback: (hp: number) => void) => void;
  /** Handler to update max HP input */
  updateMaxHpInput: (value: string) => void;
  /** Handler to start max HP edit */
  startMaxHpEdit: (uid: string) => void;
  /** Handler to submit max HP edit */
  submitMaxHpEdit: (callback: (maxHp: number) => void) => void;

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------
  /** ID of currently selected object */
  selectedObjectId: string | null;
  /** IDs of all selected objects */
  selectedObjectIds: string[];
  /** Handler for single object selection */
  handleObjectSelection: (id: string | null) => void;
  /** Handler for batch object selection */
  handleObjectSelectionBatch: (ids: string[]) => void;
  /** Handler to lock selected objects */
  lockSelected: () => void;
  /** Handler to unlock selected objects */
  unlockSelected: () => void;

  // -------------------------------------------------------------------------
  // Player Actions
  // -------------------------------------------------------------------------
  /** Player action handlers */
  playerActions: {
    renamePlayer: (name: string) => void;
    setPortrait: (url: string) => void;
    setHP: (hp: number, maxHp: number) => void;
    applyPlayerState: (state: PlayerState, tokenId?: string) => void;
    setStatusEffects: (effects: string[]) => void;
    setPlayerStagingZone: (zone: PlayerStagingZone | undefined) => void;
    addCharacter: (name: string) => void;
    deleteCharacter: (id: string) => void;
    updateCharacterName: (id: string, name: string) => void;
    updateCharacterHP: (characterId: string, hp: number, maxHp: number) => void;
  };

  // -------------------------------------------------------------------------
  // Scene Objects
  // -------------------------------------------------------------------------
  /** Map scene object (if exists) */
  mapSceneObject: { id: string; locked: boolean; transform: SceneObjectTransform } | null;
  /** Staging zone scene object (if exists) */
  stagingZoneSceneObject: { id: string; locked: boolean } | null;
  /** Handler to recolor a token */
  recolorToken: (sceneId: string, owner?: string | null) => void;
  /** Handler to transform a scene object */
  transformSceneObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  /** Handler to toggle scene object lock */
  toggleSceneObjectLock: (id: string, locked: boolean) => void;
  /** Handler to delete a token */
  deleteToken: (id: string) => void;
  /** Handler to update token image */
  updateTokenImage: (id: string, imageUrl: string) => void;
  /** Handler to update token size */
  updateTokenSize: (tokenId: string, size: TokenSize) => void;

  // -------------------------------------------------------------------------
  // Alignment
  // -------------------------------------------------------------------------
  /** Captured alignment points */
  alignmentPoints: AlignmentPoint[];
  /** Current alignment suggestion */
  alignmentSuggestion: AlignmentSuggestion | null;
  /** Alignment error message */
  alignmentError: string | null;
  /** Handler to start alignment */
  handleAlignmentStart: () => void;
  /** Handler to reset alignment points */
  handleAlignmentReset: () => void;
  /** Handler to cancel alignment */
  handleAlignmentCancel: () => void;
  /** Handler to apply alignment */
  handleAlignmentApply: () => void;
  /** Handler for alignment point capture */
  handleAlignmentPointCapture: (point: AlignmentPoint) => void;

  // -------------------------------------------------------------------------
  // Dice
  // -------------------------------------------------------------------------
  /** Roll history entries */
  rollHistory: RollLogEntry[];
  /** Currently viewing roll */
  viewingRoll: RollLogEntry | null;
  /** Handler for dice roll */
  handleRoll: (result: RollResult) => void;
  /** Handler to clear roll log */
  handleClearLog: () => void;
  /** Handler to view a roll from history */
  handleViewRoll: (roll: RollLogEntry | null) => void;

  // -------------------------------------------------------------------------
  // Room Password
  // -------------------------------------------------------------------------
  /** Room password status message */
  roomPasswordStatus: { type: "success" | "error"; message: string } | null;
  /** Whether room password operation is pending */
  roomPasswordPending: boolean;
  /** Handler to set room password */
  handleSetRoomPassword: (password: string) => void;
  /** Handler to dismiss room password status */
  dismissRoomPasswordStatus: () => void;

  // -------------------------------------------------------------------------
  // NPC Management
  // -------------------------------------------------------------------------
  /** Handler to create NPC */
  handleCreateNPC: () => void;
  /** Handler to update NPC */
  handleUpdateNPC: (id: string, updates: Partial<Character>) => void;
  /** Handler to delete NPC */
  handleDeleteNPC: (id: string) => void;
  /** Handler to place NPC token */
  handlePlaceNPCToken: (id: string) => void;
  /** Handler to delete player token */
  handleDeletePlayerToken: (tokenId: string) => void;

  // -------------------------------------------------------------------------
  // Prop Management
  // -------------------------------------------------------------------------
  /** Handler to create prop */
  handleCreateProp: () => void;
  /** Handler to update prop */
  handleUpdateProp: (id: string, updates: PropUpdate) => void;
  /** Handler to delete prop */
  handleDeleteProp: (id: string) => void;

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------
  /** Handler to save session */
  handleSaveSession: (sessionName: string) => void;
  /** Handler to load session */
  handleLoadSession: () => void;

  // -------------------------------------------------------------------------
  // DM Management
  // -------------------------------------------------------------------------
  /** Handler to toggle DM mode */
  handleToggleDM: (next: boolean) => void;
  /** Handler to set map background */
  setMapBackgroundURL: (url: string) => void;
  /** Handler to set grid size */
  setGridSize: (size: number) => void;
  /** Handler to set grid square size */
  setGridSquareSize: (size: number) => void;

  // -------------------------------------------------------------------------
  // Toast
  // -------------------------------------------------------------------------
  /** Toast notification state */
  toast: ToastState;

  // -------------------------------------------------------------------------
  // WebSocket
  // -------------------------------------------------------------------------
  /** Handler to send messages to server */
  sendMessage: (message: ClientMessage) => void;
}
