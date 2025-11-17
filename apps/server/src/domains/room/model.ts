// ============================================================================
// ROOM DOMAIN - MODEL
// ============================================================================
// Defines the room state structure and snapshot

import type {
  RoomSnapshot,
  Token,
  Player,
  Pointer,
  Drawing,
  DiceRoll,
  Character,
  Prop,
  SceneObject,
  SelectionState,
  SelectionStateEntry,
  PlayerStagingZone,
} from "@shared";
import type { DrawingOperation } from "../map/types.js";

/**
 * Room state - holds all game data for a session
 */
export type SelectionStateMap = Map<string, SelectionStateEntry>;

export interface RoomState {
  users: string[]; // Connected user UIDs (legacy)
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
}

/**
 * Create an empty room state
 */
export function createEmptyRoomState(): RoomState {
  return {
    users: [],
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
  };
}

/**
 * Create a Map-backed selection store from a plain object snapshot
 */
export function createSelectionMap(initial?: SelectionState): SelectionStateMap {
  const map: SelectionStateMap = new Map();
  if (!initial) {
    return map;
  }

  for (const [uid, entry] of Object.entries(initial)) {
    if (!entry) {
      continue;
    }

    if (entry.mode === "single") {
      map.set(uid, { mode: "single", objectId: entry.objectId });
    } else {
      map.set(uid, { mode: "multiple", objectIds: [...entry.objectIds] });
    }
  }

  return map;
}

/**
 * Convert selection map into a serializable record for clients
 */
export function selectionMapToRecord(map: SelectionStateMap): SelectionState {
  const serialized: SelectionState = {};

  for (const [uid, entry] of map.entries()) {
    if (entry.mode === "single") {
      serialized[uid] = { mode: "single", objectId: entry.objectId };
    } else {
      serialized[uid] = { mode: "multiple", objectIds: [...entry.objectIds] };
    }
  }

  return serialized;
}

/**
 * Convert room state to snapshot for client
 * @param state - Room state
 * @param isDM - Whether the recipient is a DM (default: true for backward compatibility)
 * @returns Snapshot with visibility filtering applied for non-DM players
 */
export function toSnapshot(state: RoomState, isDM: boolean = true): RoomSnapshot {
  // Filter characters based on visibility (DM sees all, players only see visible NPCs)
  const visibleCharacters = isDM
    ? state.characters
    : state.characters.filter((c) => c.visibleToPlayers !== false);

  // Get IDs of hidden NPC tokens to filter from tokens array
  const hiddenCharacterTokenIds = isDM
    ? []
    : (state.characters
        .filter((c) => c.visibleToPlayers === false && c.tokenId)
        .map((c) => c.tokenId) as string[]);

  // Filter tokens to exclude hidden NPC tokens
  const visibleTokens = isDM
    ? state.tokens
    : state.tokens.filter((t) => !hiddenCharacterTokenIds.includes(t.id));

  return {
    users: state.users,
    tokens: visibleTokens,
    players: state.players,
    characters: visibleCharacters,
    props: state.props,
    mapBackground: state.mapBackground,
    pointers: state.pointers,
    drawings: state.drawings,
    gridSize: state.gridSize,
    gridSquareSize: state.gridSquareSize,
    diceRolls: state.diceRolls,
    sceneObjects: state.sceneObjects,
    selectionState: selectionMapToRecord(state.selectionState),
    playerStagingZone: state.playerStagingZone ?? undefined,
    combatActive: state.combatActive,
    currentTurnCharacterId: state.currentTurnCharacterId,
  };
}
