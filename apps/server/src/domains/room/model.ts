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
  SceneObject,
} from "@shared";

/**
 * Room state - holds all game data for a session
 */
export interface RoomState {
  users: string[]; // Connected user UIDs (legacy)
  tokens: Token[]; // All tokens on the map
  players: Player[]; // Player metadata
  characters: Character[]; // Character data (PCs and NPCs)
  mapBackground?: string; // Background image URL/base64
  pointers: Pointer[]; // Temporary pointer indicators
  drawings: Drawing[]; // Freehand drawings
  gridSize: number; // Synchronized grid size
  gridSquareSize: number; // How many feet per grid square (default: 5ft)
  diceRolls: DiceRoll[]; // Dice roll history
  drawingRedoStacks: Record<string, Drawing[]>; // Per-player redo stacks
  sceneObjects: SceneObject[]; // Unified scene graph
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
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    gridSquareSize: 5, // Default: 5 feet per square (D&D standard)
    diceRolls: [],
    drawingRedoStacks: {},
    sceneObjects: [],
  };
}

/**
 * Convert room state to snapshot for client
 */
export function toSnapshot(state: RoomState): RoomSnapshot {
  return {
    users: state.users,
    tokens: state.tokens,
    players: state.players,
    characters: state.characters,
    mapBackground: state.mapBackground,
    pointers: state.pointers,
    drawings: state.drawings,
    gridSize: state.gridSize,
    gridSquareSize: state.gridSquareSize,
    diceRolls: state.diceRolls,
    sceneObjects: state.sceneObjects,
  };
}
