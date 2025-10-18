// ============================================================================
// SHARED TYPE DEFINITIONS
// ============================================================================
// These types are shared between the client and server to ensure type safety
// across the WebSocket communication layer and data structures.

// Export domain models
export { TokenModel, PlayerModel, CharacterModel } from "./models.js";

// ----------------------------------------------------------------------------
// GAME ENTITY TYPES
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// SCENE GRAPH
// ----------------------------------------------------------------------------

export type SceneObjectType =
  | "map"
  | "token"
  | "drawing"
  | "pointer"
  | "prop"
  | "staging-zone";

export interface SceneObjectTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // Degrees
}

interface SceneObjectBase {
  id: string;
  type: SceneObjectType;
  owner?: string | null; // For permission checks
  locked?: boolean;
  zIndex: number;
  transform: SceneObjectTransform;
}

export interface MapSceneData {
  imageUrl?: string;
  width?: number;
  height?: number;
}

export interface TokenSceneData {
  characterId?: string | null;
  color: string;
  imageUrl?: string;
  size?: TokenSize;
}

export interface DrawingSceneData {
  drawing: Drawing;
}

export interface PointerSceneData {
  uid: string;
  pointerId?: string;
  name: string;
}

export interface PropSceneData {
  assetId?: string;
  label?: string;
}

export interface StagingZoneSceneData {
  width: number;
  height: number;
  rotation?: number;
  label?: string;
}

export type SceneObject =
  | (SceneObjectBase & { type: "map"; data: MapSceneData })
  | (SceneObjectBase & { type: "token"; data: TokenSceneData })
  | (SceneObjectBase & { type: "drawing"; data: DrawingSceneData })
  | (SceneObjectBase & { type: "pointer"; data: PointerSceneData })
  | (SceneObjectBase & { type: "prop"; data: PropSceneData })
  | (SceneObjectBase & { type: "staging-zone"; data: StagingZoneSceneData });

/**
 * Token size variants (D&D 5e size categories)
 */
export type TokenSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

/**
 * Token: Represents a player's game piece on the map
 */
export interface Token {
  id: string; // Unique identifier for the token
  owner: string; // UID of the player who owns this token
  x: number; // Grid X position
  y: number; // Grid Y position
  color: string; // Color of the token (HSL format)
  imageUrl?: string; // Optional image to render instead of colored circle
  size?: TokenSize; // Token size (defaults to medium)
  locked?: boolean; // Whether the token is locked (Phase 10/11)
}

/**
 * DiceRoll: Represents a dice roll result for network sync
 */
export interface DiceRoll {
  id: string; // Unique roll identifier
  playerUid: string; // Who made the roll
  playerName: string; // Player name at time of roll
  formula: string; // Human-readable formula (e.g., "2d20 + 5")
  total: number; // Final result
  breakdown: {
    // Detailed breakdown per die/modifier
    tokenId: string;
    die?: string;
    rolls?: number[];
    subtotal: number;
  }[];
  timestamp: number; // When the roll occurred
}

/**
 * Player: Represents a connected player in the session
 */
export interface Player {
  uid: string; // Unique player identifier
  name: string; // Display name
  portrait?: string; // Base64 encoded image or URL
  micLevel?: number; // Current microphone level (0-1) for visual feedback
  hp?: number; // Current hit points
  maxHp?: number; // Maximum hit points
  lastHeartbeat?: number; // Timestamp of last heartbeat (for timeout detection)
  isDM?: boolean; // Whether the player currently has DM tools enabled
  statusEffects?: string[]; // Active status effect identifiers/labels
}

/**
 * PlayerState: Serialized player data for persistence
 */
export interface PlayerState {
  name: string;
  hp: number;
  maxHp: number;
  portrait?: string | null;
  tokenImage?: string | null; // Legacy support (deprecated in favor of token.imageUrl)
  color?: string; // Legacy support (mirrors token.color)
  token?: PlayerStateTokenSnapshot;
  statusEffects?: string[];
  drawings?: Drawing[];
}

export interface PlayerStateTokenSnapshot {
  id?: string;
  color?: string;
  imageUrl?: string | null;
  position?: { x: number; y: number };
  size?: TokenSize;
  rotation?: number;
  scale?: { x: number; y: number };
}

/**
 * Pointer: Temporary pointer indicator that players can place on the map
 */
export interface Pointer {
  id: string; // Unique identifier for this specific pointer instance
  uid: string; // Player who placed the pointer
  x: number; // Screen/canvas X coordinate
  y: number; // Screen/canvas Y coordinate
  name: string; // Name of the player when the pointer was placed
  timestamp: number; // When the pointer was placed (for auto-removal)
}

/**
 * Drawing: Represents any drawing on the map canvas
 * Supports multiple tool types: freehand, line, rectangle, circle, etc.
 */
export interface Drawing {
  id: string; // Unique identifier
  owner?: string; // UID of player who created this drawing
  type: "freehand" | "line" | "rect" | "circle" | "eraser"; // Drawing tool type
  points: { x: number; y: number }[]; // Path points or shape bounds
  color: string; // Line/fill color
  width: number; // Line thickness
  opacity: number; // Opacity (0-1)
  filled?: boolean; // For shapes: filled vs outline only
  selectedBy?: string; // UID of player who has this drawing selected (for editing)
}

/**
 * DrawingSegmentPayload: Data required to create a new drawing segment generated
 * after a partial erase operation. Server will assign a fresh id and owner.
 */
export type DrawingSegmentPayload = Omit<Drawing, "id">;

/**
 * Character: Represents a player character (PC) in the game
 * Phase 1: PC only, NPC support coming in Phase 2 with templates
 */
export interface Character {
  id: string; // Unique character identifier
  type: "pc" | "npc"; // Character type (player character or NPC)
  name: string; // Character name
  portrait?: string; // Character portrait (Base64 or URL)
  hp: number; // Current hit points
  maxHp: number; // Maximum hit points
  tokenId?: string | null; // ID of token on map (null if no token)
  ownedByPlayerUID?: string | null; // Player who controls this character (null = unclaimed)
  tokenImage?: string | null; // Optional token image URL for NPC tokens

  // Future fields (Phase 2+):
  // templateId?: string;        // Link to character template (for NPCs)
  // status?: "active" | "dead" | "unconscious" | "retired" | "hidden";
  // permissions?: CharacterPermissions; // Advanced ownership/visibility
}

// ----------------------------------------------------------------------------
// ROOM STATE
// ----------------------------------------------------------------------------

/**
 * RoomSnapshot: Complete state of the game room
 * This is broadcast to all clients whenever any state changes
 */
export interface RoomSnapshot {
  users: string[]; // Legacy array of UIDs (deprecated, use players)
  tokens: Token[]; // All tokens on the map
  players: Player[]; // All connected players
  characters: Character[]; // All characters (PCs and NPCs)
  mapBackground?: string; // Base64 encoded background image or URL
  pointers: Pointer[]; // Active pointer indicators
  drawings: Drawing[]; // All drawings on the canvas
  gridSize: number; // Synchronized grid size for all clients
  gridSquareSize?: number; // How many feet per grid square (default: 5ft)
  diceRolls: DiceRoll[]; // History of dice rolls
  sceneObjects?: SceneObject[]; // Unified scene graph (experimental)
  selectionState?: SelectionState; // Active object selections keyed by player UID
  playerStagingZone?: PlayerStagingZone; // DM-defined spawn area for player tokens
}

export interface PlayerStagingZone {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

// ----------------------------------------------------------------------------
// SELECTION MESSAGES
// ----------------------------------------------------------------------------

export type SelectionMode = "replace" | "append" | "subtract";

export interface SelectObjectMessage {
  t: "select-object";
  uid: string;
  objectId: string;
}

export interface DeselectObjectMessage {
  t: "deselect-object";
  uid: string;
}

export interface SelectMultipleMessage {
  t: "select-multiple";
  uid: string;
  objectIds: string[];
  mode?: SelectionMode;
}

export interface LockSelectedMessage {
  t: "lock-selected";
  uid: string;
  objectIds: string[];
}

export interface UnlockSelectedMessage {
  t: "unlock-selected";
  uid: string;
  objectIds: string[];
}

export interface SelectionStateSingle {
  mode: "single";
  objectId: string;
}

export interface SelectionStateMultiple {
  mode: "multiple";
  objectIds: string[];
}

export type SelectionStateEntry = SelectionStateSingle | SelectionStateMultiple;

export type SelectionState = Record<string, SelectionStateEntry>;

// ----------------------------------------------------------------------------
// WEBSOCKET MESSAGES
// ----------------------------------------------------------------------------

/**
 * ClientMessage: Messages sent from client to server
 */
export type ClientMessage =
  // Token actions
  | { t: "move"; id: string; x: number; y: number } // Move a token to new position
  | { t: "recolor"; id: string } // Randomize token color
  | { t: "delete-token"; id: string } // Remove a token
  | { t: "update-token-image"; tokenId: string; imageUrl: string } // Update token image URL
  | { t: "set-token-size"; tokenId: string; size: TokenSize } // Change token size (Phase 11)
  | { t: "set-token-color"; tokenId: string; color: string } // Explicitly set token color

  // Selection actions
  | SelectObjectMessage
  | DeselectObjectMessage
  | SelectMultipleMessage
  | LockSelectedMessage
  | UnlockSelectedMessage

  // Player actions
  | { t: "portrait"; data: string } // Update player portrait
  | { t: "rename"; name: string } // Change player name
  | { t: "mic-level"; level: number } // Update mic level for visual feedback
  | { t: "set-hp"; hp: number; maxHp: number } // Update player HP
  | { t: "toggle-dm"; isDM: boolean } // Toggle DM role flag
  | { t: "set-status-effects"; effects: string[] } // Replace active status effects for the player

  // Character actions (Phase 1: PCs only)
  | { t: "create-character"; name: string; maxHp: number; portrait?: string } // DM creates PC slot
  | { t: "claim-character"; characterId: string } // Player claims unclaimed PC
  | { t: "update-character-hp"; characterId: string; hp: number; maxHp: number } // Update character HP
  | { t: "link-token"; characterId: string; tokenId: string } // Link token to character
  | {
      t: "create-npc";
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
    }
  | {
      t: "update-npc";
      id: string;
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
    }
  | { t: "delete-npc"; id: string }
  | { t: "place-npc-token"; id: string }

  // Map/canvas actions
  | { t: "map-background"; data: string } // Set map background image
  | { t: "grid-size"; size: number } // Change grid size (synced)
  | { t: "grid-square-size"; size: number } // Change grid square size in feet (default: 5ft)
  | { t: "point"; x: number; y: number } // Place pointer indicator
  | { t: "draw"; drawing: Drawing } // Add a drawing
  | { t: "undo-drawing" } // Undo last drawing by this player
  | { t: "redo-drawing" } // Redo last undone drawing by this player
  | { t: "clear-drawings" } // Remove all drawings
  | { t: "select-drawing"; id: string } // Select a drawing for editing
  | { t: "deselect-drawing" } // Deselect current drawing
  | { t: "move-drawing"; id: string; dx: number; dy: number } // Move a drawing by delta
  | { t: "delete-drawing"; id: string } // Delete a specific drawing
  | { t: "erase-partial"; deleteId: string; segments: DrawingSegmentPayload[] } // Partially erase a freehand drawing
  | { t: "sync-player-drawings"; drawings: Drawing[] } // Replace player's drawings with provided set
  | { t: "set-player-staging-zone"; zone: PlayerStagingZone | undefined } // DM sets/clears player staging zone

  // Dice rolls
  | { t: "dice-roll"; roll: DiceRoll } // Broadcast a dice roll
  | { t: "clear-roll-history" } // Clear all dice rolls

  // Room management
  | { t: "clear-all-tokens" } // Remove all tokens/players except self
  | { t: "heartbeat" } // Keep-alive ping from client
  | { t: "load-session"; snapshot: RoomSnapshot } // Load a saved session state
  | {
      t: "transform-object";
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
      locked?: boolean;
    }
  | { t: "set-room-password"; secret: string }

  // Authentication
  | { t: "authenticate"; secret: string; roomId?: string } // Authenticate with room secret

  // WebRTC signaling
  | { t: "rtc-signal"; target: string; signal: unknown }; // P2P voice chat signaling

/**
 * ServerMessage: Messages sent from server to clients
 */
export type ServerMessage =
  | RoomSnapshot // Full room state update
  | { t: "rtc-signal"; from: string; signal: unknown } // WebRTC signal from another peer
  | { t: "auth-ok" } // Authentication succeeded
  | { t: "auth-failed"; reason?: string } // Authentication failed
  | { t: "room-password-updated"; updatedAt: number; source: "env" | "fallback" | "user" }
  | { t: "room-password-update-failed"; reason?: string };
