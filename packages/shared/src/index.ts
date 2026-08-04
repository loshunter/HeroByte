// ============================================================================
// SHARED TYPE DEFINITIONS
// ============================================================================
// These types are shared between the client and server to ensure type safety
// across the WebSocket communication layer and data structures.

import type {
  CreateMapDocumentInput,
  MapDocument,
  MapDocumentSummary,
  MapElementsSnapshot,
} from "./mapStudioTypes.js";
import type { MapStudioCommand } from "./mapStudioCommands.js";
import type { CompiledDoorState, CompiledScene } from "./sceneCompiler.js";
import type { TerrainMap } from "./terrain.js";
import type { DiceRollMode, DiceVisibility } from "./dice.js";

// WebSocket close codes — value re-export from a sub-module (see wsCloseCodes.ts
// for why it must not be a direct `export const` here).
export { WS_CLOSE_AUTH_REJECTED, WS_CLOSE_REPLACED } from "./wsCloseCodes.js";

// Export domain models
export { TokenModel, PlayerModel, CharacterModel } from "./models.js";

// Export HP utilities
export {
  normalizeHPValues,
  parseHPInput,
  parseMaxHPInput,
  hpBadgeFor,
  coerceMonsterHpDisplay,
  MONSTER_HP_DISPLAY_MODES,
} from "./hpUtils.js";
export type { NormalizedHP } from "./hpUtils.js";

// Export combat utilities
export {
  shouldCharacterParticipateInCombat,
  filterCombatEligibleCharacters,
  isDMCharacter,
} from "./combatUtils.js";

// Export the versioned map-authoring model separately from live room state.
export * from "./mapStudio.js";
export * from "./mapStudioElements.js";
export * from "./mapStudioCommands.js";

// Export the publish-time compiler that turns a map document into the
// play-surface geometry (walls, doors, lights) a live room enforces.
export * from "./sceneCompiler.js";
// Live-authoring recompile helpers (door runtime-state preservation).
export * from "./scenePublish.js";
export * from "./sceneGeometry.js";
export * from "./visibility.js";

// The Terrain Brush's pure autotiling core (47-blob + quarter-tile math).
export * from "./autotile.js";

// Seeded RNG: the determinism contract under the scatter brush, generation
// recipes, and Cartridge Codes.
export * from "./rng.js";

// Dice NOTATION only — what a formula means, and nothing that rolls one. The
// roller is server-side on purpose (see dice.ts).
export * from "./dice.js";

// Terrain storage: RLE-compressed 16x16 chunks — the Terrain Brush's wire
// format (golden-tested; changes are schema migrations).
export * from "./terrain.js";

// ----------------------------------------------------------------------------
// GAME ENTITY TYPES
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// SCENE GRAPH
// ----------------------------------------------------------------------------

export type SceneObjectType = "map" | "token" | "drawing" | "pointer" | "prop" | "staging-zone";

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
  imageUrl: string;
  label?: string;
  size: TokenSize;
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
 * DiceRoll: one settled roll, as the SERVER produced it.
 *
 * Every field here is the server's own work. `playerUid` and `playerName` are
 * stamped from the sending connection (like ChatMessage below), and `total`,
 * `breakdown` and `formula` come from evaluating the client's formula with the
 * server's RNG. Nothing on the wire from a client can set any of them — which
 * is the whole of arc defect D2, and why `{ t: "dice-roll" }` carries a
 * formula rather than a result.
 */
export interface DiceRoll {
  id: string; // Server-minted roll identifier
  playerUid: string; // Who rolled — bound from the connection, never the client
  playerName: string; // Roller's display name at roll time
  formula: string; // Canonical notation the server actually rolled (e.g., "2d20 + 5")
  total: number; // Final result, computed server-side
  breakdown: {
    // Detailed breakdown per term, in formula order
    tokenId: string; // Positional key ("t0", "t1", …) for rendering
    die?: string;
    rolls?: number[];
    /**
     * Under advantage/disadvantage, the set that was thrown away. Present only
     * on the one term the mode applied to; the log shows it struck through.
     */
    dropped?: number[];
    subtotal: number; // Signed: a "- 1d4" term contributes a negative subtotal
  }[];
  /** Absent means "normal" — the wire default and every pre-S5 roll. */
  mode?: DiceRollMode;
  /**
   * Who may see this roll. Absent means public.
   *
   * SECRECY: filtered per recipient in the snapshot, so a `self` or `dm` roll
   * is never serialized to a socket that should not have it. Bounded by the
   * same client-asserted-uid caveat as whispers — see visibleRollsFor.
   */
  visibility?: DiceVisibility;
  timestamp: number; // When the roll occurred
}

/**
 * ChatMessage: one line of table talk.
 *
 * `authorUid` and `authorName` are stamped by the SERVER from the sending
 * connection. Nothing a client sends can set them — the same rule DiceRoll
 * above now follows. (Dice did not, until S5: a client-supplied playerUid was
 * stored verbatim, which was arc defect D2.)
 *
 * `authorName` is a snapshot of the name at send time rather than a join
 * against `players`, so renaming yourself does not rewrite your history.
 */
export interface ChatMessage {
  id: string; // Unique message identifier
  authorUid: string; // Who sent it — bound from the connection, never the client
  authorName: string; // Author's display name at send time
  text: string; // Message body (plain text; never rendered as HTML)
  /**
   * Whisper target's uid. Absent means the whole table.
   *
   * SECRECY: the server filters this per recipient in the snapshot, so a
   * whisper is never serialized to anyone but its author and its target.
   * Do not rely on the client to hide it.
   *
   * Bounded by the identity model, though: `uid` is client-asserted (signed
   * session tokens are deferred — see session-one-arc.md §7), so a whisper is
   * private from the other people at the table, NOT from someone willing to
   * reconnect under their uid. See visibleChatFor for the full note.
   */
  to?: string;
  timestamp: number; // When the message was sent
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
  tempHp?: number; // Temporary hit points (absorbed before regular HP)
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
  tempHp?: number; // Temporary hit points (absorbed before regular HP)
  portrait?: string | null;
  tokenImage?: string | null; // Legacy support (deprecated in favor of token.imageUrl)
  color?: string; // Legacy support (mirrors token.color)
  token?: PlayerStateTokenSnapshot;
  statusEffects?: string[];
  drawings?: Drawing[];
  initiativeModifier?: number; // Initiative modifier saved with player state
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
 * DragPreviewUpdate: Client-supplied drag preview payload describing a scene object position.
 * Scene IDs follow the scene graph naming convention (e.g., "token:abc123").
 */
export interface DragPreviewUpdate {
  id: string;
  x: number;
  y: number;
}

/**
 * DragPreviewObject: Server-resolved drag preview entry including canonical tokenId.
 */
export interface DragPreviewObject extends DragPreviewUpdate {
  tokenId: string;
}

/**
 * DragPreviewEvent: High-frequency token drag preview payload broadcast to clients.
 */
export interface DragPreviewEvent {
  uid: string;
  timestamp: number;
  objects: DragPreviewObject[];
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
  tempHp?: number; // Temporary hit points (absorbed before regular HP)
  tokenId?: string | null; // ID of token on map (null if no token)
  ownedByPlayerUID?: string | null; // Player who controls this character (null = unclaimed)
  tokenImage?: string | null; // Optional token image URL for NPC tokens
  initiative?: number; // Initiative roll value (d20 + modifier)
  initiativeModifier?: number; // Initiative modifier (bonus/penalty added to d20 roll)
  statusEffects?: string[]; // Active status effect identifiers/labels (per character)
  visibleToPlayers?: boolean; // DM can hide NPCs from players (undefined/true = visible, false = hidden)

  // Future fields (Phase 2+):
  // templateId?: string;        // Link to character template (for NPCs)
  // status?: "active" | "dead" | "unconscious" | "retired" | "hidden";
  // permissions?: CharacterPermissions; // Advanced ownership/visibility
}

/**
 * How much of a monster's health a player may see. A per-room DM setting,
 * enforced SERVER-SIDE in the recipient filter — "hidden" means the numbers
 * never serialize to a player's socket, not that a renderer skips them.
 */
export type MonsterHpDisplay = "exact" | "bloodied" | "hidden";

/** The coarse health signal players get in "bloodied" mode (5e: hp ≤ max/2). */
export type HpBadge = "healthy" | "bloodied";

/**
 * A character as ONE RECIPIENT sees it. Server room state always holds full
 * `Character` records (hp/maxHp required — domain code keeps its invariants);
 * this is the wire shape, where an NPC's numbers may have been redacted per
 * the room's `monsterHpDisplay`. `hpBadge` exists only in "bloodied" mode,
 * and only on redacted NPCs; PCs always carry exact numbers.
 */
export interface SnapshotCharacter extends Omit<Character, "hp" | "maxHp" | "tempHp"> {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  hpBadge?: HpBadge;
}

/**
 * Prop: Represents a placeable object, item, or scenery on the map
 * Props can be assigned ownership to control who can move/transform them
 */
export interface Prop {
  id: string; // Unique prop identifier
  label: string; // Display name
  imageUrl: string; // Image to render
  owner: string | null; // null="DM only", "*"="Everyone", playerId="Specific player"
  size: TokenSize; // Base size preset (tiny/small/medium/large/huge/gargantuan)
  x: number; // Grid X position
  y: number; // Grid Y position
  scaleX: number; // Scale multiplier (applied on top of size preset)
  scaleY: number; // Scale multiplier (applied on top of size preset)
  rotation: number; // Rotation in degrees
}

// ----------------------------------------------------------------------------
// ROOM STATE
// ----------------------------------------------------------------------------

/**
 * RoomSnapshot: Complete state of the game room
 * This is broadcast to all clients whenever any state changes
 */
export type SnapshotAssetType = "map-background" | "drawings";

export interface SnapshotAsset<TPayload = unknown> {
  id: string;
  type: SnapshotAssetType;
  hash: string;
  size: number;
  encoding?: "string" | "json";
  payload?: TPayload;
}

export type SnapshotAssetRefs = Partial<Record<SnapshotAssetType, string>>;

/**
 * How the client rendered the published background SVG. "full" (and absent,
 * for legacy clients) means terrain/grid/background are baked into the SVG;
 * "elements-only" means the SVG is transparent and carries only elements, so
 * the server attaches `mapTerrain` for the table to draw live (R5).
 */
export type MapPublishBackgroundMode = "full" | "elements-only";

/**
 * Painted terrain published to the live table: the document's RLE terrain
 * plus the lattice it indexes (document pixel space — the same space the
 * background SVG renders in, independent of the table's live grid setting).
 * Visible map art only; never a channel for hidden information.
 */
export interface MapTerrainSnapshot {
  terrain: TerrainMap;
  grid: { size: number; offsetX: number; offsetY: number };
  /**
   * The terrain-kind layer's opacity (0..1). Baked into the full-render SVG
   * today; carried here so an elements-only table render matches it exactly
   * (the live surface applies it as globalAlpha). Defaults to 1.
   */
  opacity: number;
}

export interface RoomSnapshot {
  users: string[]; // Legacy array of UIDs (deprecated, use players)
  tokens: Token[]; // All tokens on the map
  players: Player[]; // All connected players
  characters: SnapshotCharacter[]; // All characters (PCs and NPCs), NPC hp possibly redacted per monsterHpDisplay
  stateVersion?: number; // Monotonically increasing room state version
  props?: Prop[]; // Props placed on the map (items, scenery, objects)
  mapBackground?: string; // Base64 encoded background image or URL
  pointers: Pointer[]; // Active pointer indicators
  drawings?: Drawing[]; // All drawings on the canvas
  gridSize: number; // Synchronized grid size for all clients
  gridSquareSize?: number; // How many feet per grid square (default: 5ft)
  diceRolls: DiceRoll[]; // History of dice rolls
  /**
   * Table chat, already filtered for THIS recipient — whispers addressed to
   * anyone else were dropped server-side before serialization.
   *
   * Optional so an older client simply ignores it and an older server that
   * omits it does not break a newer client.
   */
  chatLog?: ChatMessage[];
  sceneObjects?: SceneObject[]; // Unified scene graph (experimental)
  selectionState?: SelectionState; // Active object selections keyed by player UID
  playerStagingZone?: PlayerStagingZone; // DM-defined spawn area for player tokens
  combatActive?: boolean; // Whether initiative tracking/combat mode is active
  currentTurnCharacterId?: string; // Character ID of whose turn it currently is
  compiledScene?: CompiledScene; // Play-surface geometry compiled at Map Studio publish (secret doors stripped for players)
  mapTerrain?: MapTerrainSnapshot; // Painted terrain published as data (only when the background is elements-only)
  mapElements?: MapElementsSnapshot; // Player-safe live-authored scenery (tiles/stamps/shapes/visible text); privacy-filtered, sent to ALL recipients
  liveMapDocumentId?: string; // DM-only: the map document auto-compiled into the live scene on every command (absent for players)
  fogEnabled?: boolean; // Whether fog of war hides the map beyond player token sightlines
  monsterHpDisplay?: MonsterHpDisplay; // DM setting: how much monster HP players see (absent = "exact")
  /**
   * True only for the default table WHILE it still opens with the password
   * published in the setup docs — i.e. it is genuinely reachable by anyone, and
   * the server clears it when it empties. Setting any other password (a DM via
   * Table Security, or HEROBYTE_ROOM_SECRET) claims the table: this goes false,
   * the auto-clear stops, and the UI drops the "public" label. Absent means not
   * public, so an older server simply never shows the label.
   */
  isPublicTable?: boolean;
  /** Display name of a private table, so every member sees it, not just its creator. */
  tableName?: string;
  assets?: SnapshotAsset[];
  assetRefs?: SnapshotAssetRefs;
}

export interface PlayerStagingZone {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

// ----------------------------------------------------------------------------
// SESSION FILE
// ----------------------------------------------------------------------------

/**
 * A complete, restorable session: the room AND the authored maps it references.
 *
 * WHY THIS IS AN ENVELOPE AND NOT JUST A SNAPSHOT. A RoomSnapshot carries the
 * map only as DERIVED output — compiledScene (walls/doors), mapTerrain (floor),
 * mapElements (scenery) — plus `liveMapDocumentId`, which is a POINTER. The
 * authored source is the MapDocument, and it lives server-side. Restore a bare
 * snapshot onto a fresh server and you get a map you can look at but never edit,
 * bound to a document that no longer exists. The documents make it whole.
 *
 * This matters because a session file has to survive being restored onto a
 * DIFFERENT server than the one that wrote it — a fresh deploy, a local dev box,
 * another DM's machine. A session file is the DM's way to carry a table across
 * that gap, so it has to be genuinely complete or it is not portable.
 *
 * PRIVACY: this is built from the DM's view and therefore contains secret doors,
 * hidden NPCs, and GM notes. It is a DM artefact — never hand it to players.
 */
export interface SessionFile {
  /** Bumped only on a breaking shape change; the loader also accepts a bare RoomSnapshot. */
  schemaVersion: 1;
  savedAt: number;
  snapshot: RoomSnapshot;
  /** Every map document in the room — not just the live one, so drafts survive too. */
  mapDocuments: MapDocument[];
  /** Which document was bound to the table, if any. */
  liveMapDocumentId?: string;
  /**
   * The BYTES behind every `upload:<hash>` / `/assets/<hash>` reference anywhere
   * in this file. Optional: a file saved before this existed simply has none,
   * and a session using only external image URLs (imgur and friends) needs none.
   *
   * Without these a session file is only restorable on a server that still holds
   * the same asset store — restore it anywhere else and the reference would
   * round-trip perfectly and resolve to a broken image, which is the worst kind
   * of "saved".
   */
  assets?: SessionAsset[];
}

/** One uploaded image, inlined so a session file is self-contained. */
export interface SessionAsset {
  /** sha256 — the asset store is content-addressed, so re-uploading restores the same id. */
  hash: string;
  mime: string;
  /** base64, no data: prefix. */
  bytes: string;
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
type ClientMessagePayload =
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
  | { t: "set-hp"; hp: number; maxHp: number; tempHp?: number } // Update player HP
  | { t: "toggle-dm"; isDM: boolean } // Toggle DM role flag
  | { t: "set-status-effects"; effects: string[] } // Replace active status effects for the player

  // Character actions (Phase 1: PCs only)
  | { t: "create-character"; name: string; maxHp: number; portrait?: string } // DM creates PC slot
  | { t: "claim-character"; characterId: string } // Player claims unclaimed PC
  | { t: "add-player-character"; name: string; maxHp?: number } // Player creates additional character for themselves
  | { t: "delete-player-character"; characterId: string } // Player deletes one of their characters
  | { t: "update-character-name"; characterId: string; name: string } // Player updates their character's name
  | { t: "update-character-hp"; characterId: string; hp: number; maxHp: number; tempHp?: number } // Update character HP
  | { t: "set-character-portrait"; characterId: string; portrait?: string } // Update character portrait
  | { t: "set-character-status-effects"; characterId: string; effects: string[] } // Set status effects for character
  | { t: "link-token"; characterId: string; tokenId: string } // Link token to character
  | {
      t: "create-npc";
      name: string;
      hp: number;
      maxHp: number;
      tempHp?: number;
      portrait?: string;
      tokenImage?: string;
    }
  | {
      t: "update-npc";
      id: string;
      name: string;
      hp: number;
      maxHp: number;
      tempHp?: number;
      portrait?: string;
      tokenImage?: string;
      initiativeModifier?: number;
    }
  | { t: "delete-npc"; id: string }
  | { t: "place-npc-token"; id: string }
  | { t: "toggle-npc-visibility"; id: string; visible: boolean }

  // Initiative/Combat actions
  | {
      t: "set-initiative";
      characterId: string;
      initiative?: number;
      initiativeModifier?: number;
    }
  | { t: "start-combat" } // Activates combat mode, sorts by initiative
  | { t: "end-combat" } // Clears all initiative and exits combat mode
  | { t: "next-turn" } // Advances to next character in initiative order
  | { t: "previous-turn" } // Goes back to previous character in initiative order
  | { t: "clear-all-initiative" } // Clears all initiative values without ending combat

  // Prop actions
  | {
      t: "create-prop";
      label: string;
      imageUrl: string;
      owner: string | null;
      size: TokenSize;
      viewport: { x: number; y: number; scale: number };
    }
  | {
      t: "update-prop";
      id: string;
      label: string;
      imageUrl: string;
      owner: string | null;
      size: TokenSize;
    }
  | { t: "delete-prop"; id: string }

  // Map/canvas actions
  | { t: "map-background"; data: string } // Set map background image
  | { t: "grid-size"; size: number } // Change grid size (synced)
  | { t: "grid-square-size"; size: number } // Change grid square size in feet (default: 5ft)
  | { t: "point"; x: number; y: number } // Place pointer indicator
  | { t: "drag-preview"; objects: DragPreviewUpdate[] }
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

  // Map Studio authoring (DM-only; kept separate from live RoomSnapshot)
  | { t: "map-studio-list" }
  | { t: "map-studio-create"; document: CreateMapDocumentInput }
  | { t: "map-studio-get"; documentId: string }
  | { t: "map-studio-command"; command: MapStudioCommand }
  | { t: "map-studio-delete"; documentId: string }
  | { t: "map-studio-import"; document: MapDocument } // Restore a serialized JSON backup as a new document
  | {
      t: "map-studio-publish";
      documentId: string;
      background: string;
      backgroundMode?: MapPublishBackgroundMode; // absent == "full" (legacy clients)
    } // Compile document into the live scene (server-authoritative geometry)
  | { t: "map-studio-set-live"; documentId: string | null } // Bind (null clears) the room's live-authored map document; edits to it auto-compile onto the table
  | {
      t: "map-studio-generate";
      documentId: string;
      commandId: string; // client-minted; doubles as the element idPrefix and the dedupe/retry key
      recipe: "dungeon";
      seed: number;
      bounds: { x: number; y: number; cols: number; rows: number }; // document-grid CELLS
      params: {
        theme: "stone" | "wood";
        density: "low" | "medium" | "high";
      };
      // NOTE: no secretDoorChance. Generated dungeons author no secret doors —
      // the recipe's regularity makes them recoverable from the player's own
      // payload. See dungeonGeometry.emitDoors.
    } // Run a server-side recipe; output applies to the document as ONE place-room command

  // Live scene interactions (compiled doors are clickable at the table)
  | { t: "toggle-door"; doorId: string } // Flip a door open/closed; locked and secret doors refuse non-DM toggles
  | { t: "set-door-state"; doorId: string; state: CompiledDoorState } // DM-only: set any door state (lock, unlock, reveal)
  | { t: "set-fog-enabled"; enabled: boolean } // DM-only: toggle fog of war for the published scene
  | { t: "set-monster-hp-display"; mode: MonsterHpDisplay } // DM-only: how much monster HP players see (enforced in the snapshot filter)

  // Dice. Carries a FORMULA, not a result: the server parses it, rolls it with
  // its own RNG, and stamps the author from the connection. There is nothing
  // here for a tampered client to lie about — no total, no uid, no name.
  // (Before S5 this was `{ roll: DiceRoll }`, stored verbatim: arc defect D2.)
  | {
      t: "dice-roll";
      formula: string; // Dice notation, e.g. "2d6 + 3" — parsed by parseDiceFormula
      mode?: DiceRollMode; // Absent means "normal"
      visibility?: DiceVisibility; // Absent means "public"
    }
  | { t: "clear-roll-history" } // Clear all dice rolls
  // Chat. Deliberately carries NO author field: the server stamps identity
  // from the connection. `to` is a whisper target's uid; omit it for the
  // whole table.
  | { t: "chat"; text: string; to?: string } // Say something at the table
  | { t: "clear-chat-log" } // Clear chat history (DM only)

  // Room management
  | { t: "clear-all-tokens" } // Remove all tokens/players except self
  | { t: "heartbeat" } // Keep-alive ping from client
  | { t: "session-export" } // DM: ask the server to bundle a complete SessionFile (see the type)
  | {
      t: "load-session";
      snapshot: RoomSnapshot;
      // The authored maps the snapshot references. Optional so a legacy save
      // file (a bare snapshot, no documents) still loads — it just restores a
      // map that cannot be edited afterwards.
      mapDocuments?: MapDocument[];
      liveMapDocumentId?: string;
    } // Load a saved session state
  | { t: "request-room-resync"; lastSeenVersion?: number; reason?: string } // Request fresh snapshot when client detects version gap
  | {
      t: "transform-object";
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
      locked?: boolean;
    }
  | { t: "set-room-password"; secret?: string } // omitted secret = reset to the server's configured default

  // Authentication
  | { t: "authenticate"; secret: string; roomId?: string } // Authenticate with room secret
  | {
      t: "create-room";
      roomId: string;
      roomPassword: string;
      dmPassword?: string;
      name?: string;
    } // Mint a private table with its own password(s); pre-auth, like authenticate
  /**
   * Copy THIS table into a brand-new private one and go there — the "keep what
   * I built" move on the test table, whose own password can never change and
   * which is wiped hourly. DM-only and post-auth (unlike create-room), because
   * it copies the table's whole contents.
   */
  | {
      t: "fork-table";
      roomId: string;
      name: string;
      roomPassword: string;
      dmPassword?: string;
    }
  | { t: "elevate-to-dm"; dmPassword: string } // Request DM elevation with DM password
  | { t: "revoke-dm" } // Revoke own DM status
  | { t: "set-dm-password"; dmPassword: string } // DM sets/updates the DM password

  // WebRTC signaling
  | { t: "rtc-signal"; target: string; signal: unknown }; // P2P voice chat signaling

export type ClientMessage = ClientMessagePayload & { commandId?: string };

/**
 * ServerMessage: Messages sent from server to clients
 */
export type ServerMessage =
  | RoomSnapshot // Full room state update
  | { t: "rtc-signal"; from: string; signal: unknown } // WebRTC signal from another peer
  | { t: "auth-ok" } // Authentication succeeded
  | { t: "auth-failed"; reason?: string } // Authentication failed
  | { t: "heartbeat-ack"; timestamp: number } // Acknowledgement for keepalive checks
  | { t: "ack"; commandId: string }
  | { t: "nack"; commandId: string; reason?: string }
  | { t: "token-updated"; stateVersion: number; token: Token } // Token delta update
  | { t: "state-sync"; stateVersion: number } // Contentless version advance for deltas withheld by vision filtering
  | { t: "pointer-preview"; pointer: Pointer } // Pointer preview event (high-frequency channel)
  | { t: "drag-preview"; preview: DragPreviewEvent } // Drag preview event (high-frequency channel)
  | { t: "map-studio-documents"; documents: MapDocumentSummary[] }
  | {
      t: "map-studio-document";
      document: MapDocument;
      appliedCommandId?: string;
      history?: { canUndo: boolean; canRedo: boolean };
    }
  | { t: "session-file"; file: SessionFile } // DM-only: the bundled reply to session-export
  | { t: "map-studio-deleted"; documentId: string }
  | {
      t: "map-studio-error";
      commandId: string;
      documentId: string;
      // "not-found": a get/open targeted a document the server no longer has
      // (e.g. an ephemeral maps store reset under a room that kept its live
      // binding) — the client clears the load and offers a fresh start
      // instead of re-fetching the dangling id forever.
      code: "revision-conflict" | "command-rejected" | "not-found";
      reason: string;
      actualRevision?: number;
    }
  | { t: "dm-status"; isDM: boolean } // DM elevation status update
  | { t: "dm-elevation-failed"; reason?: string } // DM elevation failed
  | { t: "dm-password-updated"; updatedAt: number } // DM password set/updated successfully
  | { t: "dm-password-update-failed"; reason?: string } // DM password update failed
  | { t: "room-password-updated"; updatedAt: number; source: "env" | "fallback" | "user" }
  | { t: "room-password-update-failed"; reason?: string }
  | { t: "room-created"; roomId: string } // A private table was minted; client may now join it
  | { t: "room-create-failed"; reason?: string }
  | { t: "table-forked"; roomId: string; name: string } // A copy of this table now lives at roomId
  | { t: "table-fork-failed"; reason?: string };
