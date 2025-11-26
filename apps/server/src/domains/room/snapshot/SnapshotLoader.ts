// ============================================================================
// SNAPSHOT LOADER
// ============================================================================
// Loads and merges saved game sessions with current server state

import type { Drawing, Player, RoomSnapshot } from "@shared";
import type { RoomState } from "../model.js";
import { createSelectionMap } from "../model.js";
import type { StagingZoneManager } from "../staging/StagingZoneManager.js";

/**
 * SnapshotLoader - Loads game session snapshots and merges with current state
 *
 * Responsibilities:
 * - Merge players: Preserve connection metadata for connected players
 * - Merge characters: Preserve characters owned by connected players
 * - Merge tokens: Preserve tokens owned by connected players
 * - Load other state fields (props, drawings, grid settings, combat state)
 * - Handle legacy drawings vs sceneObjects
 * - Sanitize staging zone data
 *
 * Extracted from: apps/server/src/domains/room/service.ts:70-161
 */
export class SnapshotLoader {
  /**
   * Load a snapshot and merge with current state
   *
   * @param snapshot - Saved game session snapshot
   * @param currentState - Current room state
   * @param stagingManager - Staging zone manager for sanitization
   * @returns New merged room state
   */
  mergeSnapshot(
    snapshot: RoomSnapshot,
    currentState: RoomState,
    stagingManager: StagingZoneManager,
  ): RoomState {
    // Merge players: Keep currently connected players, update their data if they exist in snapshot
    const loadedPlayers = (snapshot.players ?? []).map((player) => ({
      ...player,
      isDM: player.isDM ?? false,
      statusEffects: Array.isArray(player.statusEffects) ? [...player.statusEffects] : [],
    }));

    const mergedPlayers = currentState.players.map((currentPlayer) => {
      // Find matching player in loaded snapshot by UID
      const savedPlayer = loadedPlayers.find((p: Player) => p.uid === currentPlayer.uid);
      if (savedPlayer) {
        // Merge: Keep current connection data (lastHeartbeat, micLevel), restore saved data
        return {
          ...savedPlayer,
          lastHeartbeat: currentPlayer.lastHeartbeat, // Keep current heartbeat
          micLevel: currentPlayer.micLevel, // Keep current mic level
        };
      }
      // Player is currently connected but wasn't in saved session - keep them
      return { ...currentPlayer, isDM: currentPlayer.isDM ?? false };
    });

    // Normalize loaded characters
    const loadedCharacters = (snapshot.characters ?? []).map((character) => ({
      ...character,
      type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
      tokenId: character.tokenId ?? null,
      tokenImage: character.tokenImage ?? null,
    }));

    // Get UIDs of currently connected players
    const currentPlayerUIDs = new Set(currentState.players.map((p) => p.uid));

    // Preserve characters belonging to currently connected players
    const currentPlayerCharacters = currentState.characters.filter(
      (char) => char.ownedByPlayerUID && currentPlayerUIDs.has(char.ownedByPlayerUID),
    );

    // Get IDs of preserved characters to avoid duplicates
    const preservedCharacterIds = new Set(currentPlayerCharacters.map((c) => c.id));

    // Add loaded characters that don't conflict with preserved ones
    const mergedCharacters = [
      ...currentPlayerCharacters,
      ...loadedCharacters.filter((char) => !preservedCharacterIds.has(char.id)),
    ];

    // Preserve tokens belonging to currently connected players
    const currentPlayerTokens = currentState.tokens.filter((token) =>
      currentPlayerUIDs.has(token.owner),
    );

    // Get IDs of preserved tokens to avoid duplicates
    const preservedTokenIds = new Set(currentPlayerTokens.map((t) => t.id));

    // Add loaded tokens that don't conflict with preserved ones
    const mergedTokens = [
      ...currentPlayerTokens,
      ...(snapshot.tokens ?? []).filter((token) => !preservedTokenIds.has(token.id)),
    ];

    const currentGridSquareSize = currentState.gridSquareSize ?? 5;

    // If snapshot has sceneObjects, don't load legacy drawings array
    // (rebuildSceneGraph will recreate drawings from sceneObjects if needed)
    const hasSceneObjects = snapshot.sceneObjects && snapshot.sceneObjects.length > 0;
    const assetMap = buildAssetMap(snapshot);
    const mapBackground = resolveMapBackground(snapshot, assetMap);
    const drawings = hasSceneObjects ? [] : resolveDrawings(snapshot, assetMap);

    return {
      users: currentState.users, // Keep current WebSocket connections
      stateVersion: Math.max(
        currentState.stateVersion ?? 0,
        typeof snapshot.stateVersion === "number" ? snapshot.stateVersion : 0,
      ),
      tokens: mergedTokens,
      players: mergedPlayers,
      characters: mergedCharacters,
      props: snapshot.props ?? [],
      mapBackground,
      pointers: [], // Clear pointers on load
      drawings,
      gridSize: snapshot.gridSize ?? 50,
      gridSquareSize: snapshot.gridSquareSize ?? currentGridSquareSize,
      diceRolls: snapshot.diceRolls ?? [],
      drawingUndoStacks: {},
      drawingRedoStacks: {},
      sceneObjects: snapshot.sceneObjects ?? currentState.sceneObjects,
      selectionState: createSelectionMap(),
      playerStagingZone: stagingManager.sanitize(snapshot.playerStagingZone),
      combatActive: snapshot.combatActive ?? false,
      currentTurnCharacterId: snapshot.currentTurnCharacterId ?? undefined,
    };
  }
}

function buildAssetMap(snapshot: RoomSnapshot): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  snapshot.assets?.forEach((asset) => {
    if (asset?.id) {
      entries.set(asset.id, asset.payload);
    }
  });
  return entries;
}

function resolveMapBackground(
  snapshot: RoomSnapshot,
  assets: Map<string, unknown>,
): string | undefined {
  if (typeof snapshot.mapBackground === "string") {
    return snapshot.mapBackground;
  }
  const assetId = snapshot.assetRefs?.["map-background"];
  if (!assetId) {
    return undefined;
  }
  const payload = assets.get(assetId);
  return typeof payload === "string" ? payload : undefined;
}

function resolveDrawings(snapshot: RoomSnapshot, assets: Map<string, unknown>): Drawing[] {
  if (Array.isArray(snapshot.drawings)) {
    return snapshot.drawings;
  }
  const assetId = snapshot.assetRefs?.drawings;
  if (!assetId) {
    return [];
  }
  const payload = assets.get(assetId);
  return Array.isArray(payload) ? (payload as Drawing[]) : [];
}
