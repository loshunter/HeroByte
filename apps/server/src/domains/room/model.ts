// ============================================================================
// ROOM DOMAIN - MODEL
// ============================================================================
// Defines the room state structure and snapshot

import type {
  CompiledScene,
  MapElementsSnapshot,
  MapTerrainSnapshot,
  RoomSnapshot,
  Token,
  Player,
  Pointer,
  Drawing,
  DiceRoll,
  Character,
  Prop,
  SceneObject,
  SelectionStateEntry,
  PlayerStagingZone,
} from "@herobyte/shared";
import { buildSnapshotAssets } from "./assets/SnapshotAssetBuilder.js";
import { compiledSceneFor } from "./compiledSceneView.js";
import { buildRecipientView } from "./snapshot/recipientFilter.js";
import { createSelectionMap } from "./selectionSerialization.js";
import type { DrawingOperation } from "../map/types.js";

/**
 * Room state - holds all game data for a session
 */
export type SelectionStateMap = Map<string, SelectionStateEntry>;

export interface RoomState {
  users: string[]; // Connected user UIDs (legacy)
  stateVersion: number; // Monotonic state counter
  tokens: Token[]; // All tokens on the map
  players: Player[]; // Player metadata
  characters: Character[]; // Character data (PCs and NPCs)
  props: Prop[]; // Props on the map (items, scenery, objects)
  mapBackground?: string; // Background image URL/base64
  pointers: Pointer[]; // Temporary pointer indicators
  drawings: Drawing[]; // Freehand drawings
  gridSize: number; // Synchronized grid size
  gridSquareSize: number; // How many feet per grid square (default: 5ft)
  diceRolls: DiceRoll[]; // Dice roll history
  drawingUndoStacks: Record<string, DrawingOperation[]>; // Per-player undo history
  drawingRedoStacks: Record<string, DrawingOperation[]>; // Per-player redo history
  sceneObjects: SceneObject[]; // Unified scene graph
  selectionState: SelectionStateMap; // Current object selections keyed by player UID
  playerStagingZone?: PlayerStagingZone; // Spawn area for player tokens
  combatActive: boolean; // Whether combat/initiative tracking is active
  currentTurnCharacterId?: string; // ID of character whose turn it currently is
  compiledScene?: CompiledScene; // Geometry compiled from the last published Map Studio document
  mapTerrain?: MapTerrainSnapshot; // Painted terrain published as data (elements-only backgrounds)
  mapElements?: MapElementsSnapshot; // Player-safe live-authored scenery (privacy-filtered at derive)
  liveMapDocumentId?: string; // Map document whose edits auto-compile into the live scene (DM-authored)
  fogEnabled: boolean; // Whether fog of war hides the map beyond player sightlines
  /** The public test table (see RoomSnapshot.isPublicTable). Set at boot. */
  isPublicTable?: boolean;
  /** Display name a private table was created or forked with. */
  tableName?: string;
}

/**
 * Create an empty room state
 */
export function createEmptyRoomState(): RoomState {
  return {
    users: [],
    stateVersion: 0,
    tokens: [],
    players: [],
    characters: [],
    props: [],
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    gridSquareSize: 5, // Default: 5 feet per square (D&D standard)
    diceRolls: [],
    drawingUndoStacks: {},
    drawingRedoStacks: {},
    sceneObjects: [],
    selectionState: createSelectionMap(),
    playerStagingZone: undefined,
    combatActive: false,
    currentTurnCharacterId: undefined,
    compiledScene: undefined,
    mapTerrain: undefined,
    mapElements: undefined,
    liveMapDocumentId: undefined,
    fogEnabled: false,
  };
}

// Selection (de)serialization moved to ./selectionSerialization.ts; re-exported
// here so the existing importers (StatePersistence, SnapshotLoader, and the
// tests) keep their import paths.
export { selectionMapToRecord } from "./selectionSerialization.js";
export { createSelectionMap };

/**
 * Convert room state to snapshot for client
 * @param state - Room state
 * @param isDM - Whether the recipient is a DM (default: true for backward compatibility)
 * @param recipientUid - Recipient identity; with fog enabled, entities outside
 *   their tokens' sightlines are stripped from the payload entirely
 * @returns Snapshot with visibility filtering applied for non-DM players
 */
export function toSnapshot(
  state: RoomState,
  isDM: boolean = true,
  recipientUid?: string,
): RoomSnapshot {
  // Everything position- or visibility-sensitive is decided in one place.
  const view = buildRecipientView(state, isDM, recipientUid);

  const { assets, assetRefs } = buildSnapshotAssets(state);

  const snapshot: RoomSnapshot = {
    users: state.users,
    stateVersion: state.stateVersion,
    tokens: view.tokens,
    players: state.players,
    characters: view.characters,
    props: view.props,
    pointers: view.pointers,
    gridSize: state.gridSize,
    gridSquareSize: state.gridSquareSize,
    diceRolls: state.diceRolls,
    sceneObjects: view.sceneObjects,
    selectionState: view.selectionState,
    playerStagingZone: state.playerStagingZone ?? undefined,
    combatActive: state.combatActive,
    currentTurnCharacterId: view.currentTurnCharacterId,
    fogEnabled: state.fogEnabled,
  };

  // Only ever sent when true — absent reads as "not a public table".
  if (state.isPublicTable) snapshot.isPublicTable = true;
  if (state.tableName) snapshot.tableName = state.tableName;

  // Secret doors and lights are DM-only; compiledSceneView owns that rule and
  // is the only place allowed to.
  if (state.compiledScene) {
    snapshot.compiledScene = compiledSceneFor(state.compiledScene, isDM);
  }

  // Terrain + live scenery are player-safe map art: the same data for every
  // role (filtered at derive/publish, unlike compiledScene's per-role door strip).
  if (state.mapTerrain) snapshot.mapTerrain = state.mapTerrain;
  if (state.mapElements) snapshot.mapElements = state.mapElements;

  // DM-only chrome: it tells the map toolbar which document its edits compile
  // into. Players have no use for it, so it never enters their payload.
  if (isDM && state.liveMapDocumentId) {
    snapshot.liveMapDocumentId = state.liveMapDocumentId;
  }

  if (assets.length > 0) {
    snapshot.assets = assets;
  }

  if (Object.keys(assetRefs).length > 0) {
    snapshot.assetRefs = assetRefs;
  }

  return snapshot;
}
