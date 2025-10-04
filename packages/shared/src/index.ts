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

/**
 * Token: Represents a player's game piece on the map
 */
export interface Token {
  id: string; // Unique identifier for the token
  owner: string; // UID of the player who owns this token
  x: number; // Grid X position
  y: number; // Grid Y position
  color: string; // Color of the token (HSL format)
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
}

/**
 * Pointer: Temporary pointer indicator that players can place on the map
 */
export interface Pointer {
  uid: string; // Player who placed the pointer
  x: number; // Screen/canvas X coordinate
  y: number; // Screen/canvas Y coordinate
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
 * Character: Represents a player character (PC) in the game
 * Phase 1: PC only, NPC support coming in Phase 2 with templates
 */
export interface Character {
  id: string; // Unique character identifier
  type: "pc"; // Phase 1: Only PCs (will add "npc" in Phase 2)
  name: string; // Character name
  portrait?: string; // Character portrait (Base64 or URL)
  hp: number; // Current hit points
  maxHp: number; // Maximum hit points
  tokenId?: string | null; // ID of token on map (null if no token)
  ownedByPlayerUID?: string | null; // Player who controls this character (null = unclaimed)

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
  diceRolls: DiceRoll[]; // History of dice rolls
}

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

  // Player actions
  | { t: "portrait"; data: string } // Update player portrait
  | { t: "rename"; name: string } // Change player name
  | { t: "mic-level"; level: number } // Update mic level for visual feedback
  | { t: "set-hp"; hp: number; maxHp: number } // Update player HP

  // Character actions (Phase 1: PCs only)
  | { t: "create-character"; name: string; maxHp: number; portrait?: string } // DM creates PC slot
  | { t: "claim-character"; characterId: string } // Player claims unclaimed PC
  | { t: "update-character-hp"; characterId: string; hp: number; maxHp: number } // Update character HP
  | { t: "link-token"; characterId: string; tokenId: string } // Link token to character

  // Map/canvas actions
  | { t: "map-background"; data: string } // Set map background image
  | { t: "grid-size"; size: number } // Change grid size (synced)
  | { t: "point"; x: number; y: number } // Place pointer indicator
  | { t: "draw"; drawing: Drawing } // Add a drawing
  | { t: "undo-drawing" } // Undo last drawing by this player
  | { t: "redo-drawing" } // Redo last undone drawing by this player
  | { t: "clear-drawings" } // Remove all drawings
  | { t: "select-drawing"; id: string } // Select a drawing for editing
  | { t: "deselect-drawing" } // Deselect current drawing
  | { t: "move-drawing"; id: string; dx: number; dy: number } // Move a drawing by delta
  | { t: "delete-drawing"; id: string } // Delete a specific drawing

  // Dice rolls
  | { t: "dice-roll"; roll: DiceRoll } // Broadcast a dice roll
  | { t: "clear-roll-history" } // Clear all dice rolls

  // Room management
  | { t: "clear-all-tokens" } // Remove all tokens/players except self
  | { t: "heartbeat" } // Keep-alive ping from client
  | { t: "load-session"; snapshot: RoomSnapshot } // Load a saved session state

  // WebRTC signaling
  | { t: "rtc-signal"; target: string; signal: unknown }; // P2P voice chat signaling

/**
 * ServerMessage: Messages sent from server to clients
 */
export type ServerMessage =
  | RoomSnapshot // Full room state update
  | { t: "rtc-signal"; from: string; signal: unknown }; // WebRTC signal from another peer
