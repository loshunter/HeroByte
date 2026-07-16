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
  SelectionState,
  SelectionStateEntry,
  PlayerStagingZone,
} from "@herobyte/shared";
import { gridCellToWorldPoint } from "@herobyte/shared";
import { buildSnapshotAssets } from "./assets/SnapshotAssetBuilder.js";
import { compiledSceneFor } from "./compiledSceneView.js";
import { createVisionContext, isWorldPointVisible } from "./scene/visionFilter.js";
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
 * @param recipientUid - Recipient identity; with fog enabled, entities outside
 *   their tokens' sightlines are stripped from the payload entirely
 * @returns Snapshot with visibility filtering applied for non-DM players
 */
export function toSnapshot(
  state: RoomState,
  isDM: boolean = true,
  recipientUid?: string,
): RoomSnapshot {
  // Filter characters based on visibility (DM sees all, players only see visible NPCs)
  const visibleCharacters = isDM
    ? state.characters
    : state.characters.filter((c) => c.visibleToPlayers !== false);

  // Collect IDs of hidden NPC tokens to filter from tokens and scene objects
  const hiddenCharacterTokenIds = isDM
    ? null
    : new Set(
        state.characters
          .filter((c) => c.visibleToPlayers === false && c.tokenId)
          .map((c) => c.tokenId as string),
      );

  // Filter tokens to exclude hidden NPC tokens
  const npcFilteredTokens = isDM
    ? state.tokens
    : state.tokens.filter((t) => !hiddenCharacterTokenIds?.has(t.id));

  // Fog of war: entities outside the recipient's sightlines never enter the
  // payload, so socket sniffing reveals nothing the fog hides. Own tokens are
  // always included.
  const vision = !isDM && recipientUid ? createVisionContext(state, recipientUid) : null;
  const visibleTokens = vision
    ? npcFilteredTokens.filter(
        (token) =>
          token.owner === recipientUid ||
          isWorldPointVisible(
            vision,
            gridCellToWorldPoint(state.gridSize, { x: token.x, y: token.y }),
          ),
      )
    : npcFilteredTokens;
  const visionTokenIds = vision ? new Set(visibleTokens.map((token) => token.id)) : null;

  // NPC character records must agree with the fog: a record whose token the
  // recipient cannot see is a spoiler (name, HP), so it never enters the
  // payload. Party members and tokenless NPCs always ride along — rosters
  // don't fog, and off-map NPCs stay governed by visibleToPlayers.
  const fogFilteredCharacters = visionTokenIds
    ? visibleCharacters.filter(
        (character) =>
          character.type !== "npc" || !character.tokenId || visionTokenIds.has(character.tokenId),
      )
    : visibleCharacters;

  // The active combatant must be someone the recipient can actually resolve.
  // Both filters above already strip a hidden or fogged NPC's record AND its
  // token — shipping its id anyway puts back exactly what they removed: proof
  // that a combatant the recipient cannot see is acting RIGHT NOW, plus a
  // stable id to correlate across rounds. The client would sound useTurnChime
  // for it too. Party members and tokenless NPCs always survive
  // fogFilteredCharacters, so a player's own turn can never strip.
  const visibleTurnCharacterId = fogFilteredCharacters.some(
    (character) => character.id === state.currentTurnCharacterId,
  )
    ? state.currentTurnCharacterId
    : undefined;

  // Pointers are world-pixel positions; fog hides pings inside unseen areas,
  // but a pinger always sees their own echo and DM pings are narration —
  // visible to the whole table.
  const dmUids = vision ? new Set(state.players.filter((p) => p.isDM).map((p) => p.uid)) : null;
  const visiblePointers = vision
    ? state.pointers.filter(
        (pointer) =>
          pointer.uid === recipientUid ||
          dmUids!.has(pointer.uid) ||
          isWorldPointVisible(vision, pointer),
      )
    : state.pointers;
  const visiblePointerIds = vision
    ? new Set(visiblePointers.map((pointer) => pointer.id ?? pointer.uid))
    : null;

  // Props are grid-cell positions; scenery inside fogged rooms stays unknown.
  const visibleProps = vision
    ? state.props.filter(
        (prop) =>
          prop.owner === recipientUid ||
          isWorldPointVisible(vision, gridCellToWorldPoint(state.gridSize, prop)),
      )
    : state.props;
  const visiblePropIds = vision ? new Set(visibleProps.map((prop) => prop.id)) : null;

  // The scene graph mirrors tokens, props, and pointers — it must agree with
  // the filtered entity lists or it becomes the leak.
  const visibleSceneObjects = state.sceneObjects.filter((object) => {
    if (isDM) {
      return true;
    }
    if (object.type === "token") {
      const tokenId = object.id.startsWith("token:") ? object.id.slice("token:".length) : null;
      if (!tokenId) return true;
      if (hiddenCharacterTokenIds?.has(tokenId)) return false;
      return visionTokenIds ? visionTokenIds.has(tokenId) : true;
    }
    if (object.type === "prop" && visiblePropIds) {
      const propId = object.id.startsWith("prop:") ? object.id.slice("prop:".length) : null;
      return !propId || visiblePropIds.has(propId);
    }
    if (object.type === "pointer" && visiblePointerIds) {
      const pointerId = object.id.startsWith("pointer:")
        ? object.id.slice("pointer:".length)
        : null;
      return !pointerId || visiblePointerIds.has(pointerId);
    }
    return true;
  });

  // Selection entries referencing objects the recipient cannot see would
  // reveal their existence and ids — strip them. References may be scene ids
  // ("token:abc") or raw entity ids, so admit both forms of every visible
  // entity. Drawings are never position-filtered.
  const selectionRecord = selectionMapToRecord(state.selectionState);
  let visibleSelection = selectionRecord;
  if (!isDM) {
    const visibleRefIds = new Set<string>();
    for (const object of visibleSceneObjects) visibleRefIds.add(object.id);
    for (const token of visibleTokens) {
      visibleRefIds.add(token.id);
      visibleRefIds.add(`token:${token.id}`);
    }
    for (const prop of visibleProps) {
      visibleRefIds.add(prop.id);
      visibleRefIds.add(`prop:${prop.id}`);
    }
    for (const drawing of state.drawings) {
      visibleRefIds.add(drawing.id);
      visibleRefIds.add(`drawing:${drawing.id}`);
    }
    visibleSelection = {};
    for (const [uid, entry] of Object.entries(selectionRecord)) {
      if (!entry) continue;
      if (entry.mode === "single") {
        if (visibleRefIds.has(entry.objectId)) visibleSelection[uid] = entry;
      } else {
        const objectIds = entry.objectIds.filter((id) => visibleRefIds.has(id));
        if (objectIds.length > 0) visibleSelection[uid] = { mode: "multiple", objectIds };
      }
    }
  }

  const { assets, assetRefs } = buildSnapshotAssets(state);

  const snapshot: RoomSnapshot = {
    users: state.users,
    stateVersion: state.stateVersion,
    tokens: visibleTokens,
    players: state.players,
    characters: fogFilteredCharacters,
    props: visibleProps,
    pointers: visiblePointers,
    gridSize: state.gridSize,
    gridSquareSize: state.gridSquareSize,
    diceRolls: state.diceRolls,
    sceneObjects: visibleSceneObjects,
    selectionState: visibleSelection,
    playerStagingZone: state.playerStagingZone ?? undefined,
    combatActive: state.combatActive,
    currentTurnCharacterId: visibleTurnCharacterId,
    fogEnabled: state.fogEnabled,
  };

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
