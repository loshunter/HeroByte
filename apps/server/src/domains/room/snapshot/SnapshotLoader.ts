// ============================================================================
// SNAPSHOT LOADER
// ============================================================================
// Loads and merges saved game sessions with current server state

import type { Drawing, Player, RoomSnapshot } from "@herobyte/shared";
import {
  coerceDefaultVisionRadius,
  coerceDiagonalRule,
  coerceMonsterHpDisplay,
  coerceMovementBudgetFields,
  coerceTokenVisionRadii,
  normalizeHPValues,
} from "@herobyte/shared";
import { normalizeAtlasState } from "../atlasState.js";
import type { RoomState } from "../model.js";
import { createSelectionMap } from "../model.js";
import {
  coerceCustomTokens,
  coerceNpcDisposition,
  coerceTokenSize,
  withoutNpcClaim,
  settleLegacyConditionLists,
} from "../persistence/loadCoercions.js";
import type { StagingZoneManager } from "../staging/StagingZoneManager.js";

/**
 * SnapshotLoader - Loads game session snapshots and merges with current state
 *
 * Responsibilities:
 * - Merge players: Preserve connection metadata for connected players
 * - Merge characters: Preserve characters owned by connected players
 * - Merge tokens: Preserve tokens owned by connected players
 * - Load other state fields (props, drawings, grid settings, combat state)
 * - Load drawings (always; the scene graph rebuilds their objects from them)
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
          // Authority is the room's own, never the file's. DM status is earned at
          // the table with the DM password, and a file can be hand-edited or come
          // from another night's table where someone else held the seat — so a
          // restore must neither crown a seated player nor demote the DM who ran it.
          isDM: currentPlayer.isDM ?? false,
          lastHeartbeat: currentPlayer.lastHeartbeat, // Keep current heartbeat
          micLevel: currentPlayer.micLevel, // Keep current mic level
        };
      }
      // Player is currently connected but wasn't in saved session - keep them
      return { ...currentPlayer, isDM: currentPlayer.isDM ?? false };
    });

    // Normalize loaded characters. Snapshot characters are the WIRE shape:
    // hp/maxHp may be absent (a redacted or hand-edited file) and hpBadge is a
    // wire-only field that must never enter room state. Room state requires
    // real numbers — normalizeHPValues turns absence into 0/1, visibly wrong
    // rather than silently NaN.
    const normalizedCharacters = (snapshot.characters ?? []).map(
      ({ hpBadge: _wireOnly, tokenSize, disposition, ...character }) => {
        const { hp, maxHp } = normalizeHPValues(character.hp ?? 0, character.maxHp ?? 1);
        // A size off the ladder is dropped, like the state file's (loadCoercions).
        const size = coerceTokenSize(tokenSize);
        // And a stance off the list, for the same reason and with sharper
        // teeth: this spread is the SECOND load door, and a value that rides
        // it reaches the card renderer, where an unknown stance has no look
        // and the throw takes the whole table down for every client on it.
        const stance = coerceNpcDisposition(disposition);
        return coerceMovementBudgetFields({
          ...withoutNpcClaim(character),
          hp,
          maxHp,
          type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
          tokenId: character.tokenId ?? null,
          tokenImage: character.tokenImage ?? null,
          ...(size ? { tokenSize: size } : {}),
          ...(stance ? { disposition: stance } : {}),
        });
      },
    );
    // Legacy condition lists settle against the FILE's own seats, before the
    // merge: seated players keep their live characters, so a file's sole
    // character could otherwise count as one of two and lose its seat's list.
    // The live characters were settled when their room loaded.
    const loadedCharacters = settleLegacyConditionLists(normalizedCharacters, loadedPlayers);

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

    // A token follows its character. The merge carries a seated player's
    // characters and the file's, and drops the rest of the room's — an NPC is the
    // file's, not a seat's. Its token must go with it: the DM owns the token of
    // every NPC they placed, so keeping "the seated uids' tokens" would leave one
    // on the map with no record behind it, and no hidden flag to hold it back —
    // the players are sent it, image and all, however secret the monster was.
    const carriedTokenIds = new Set<string>();
    for (const character of mergedCharacters) {
      if (character.tokenId) carriedTokenIds.add(character.tokenId);
    }
    const strandedTokenIds = new Set<string>();
    for (const character of currentState.characters) {
      if (character.tokenId && !carriedTokenIds.has(character.tokenId)) {
        strandedTokenIds.add(character.tokenId);
      }
    }

    // Preserve tokens belonging to currently connected players
    const currentPlayerTokens = currentState.tokens.filter(
      (token) => currentPlayerUIDs.has(token.owner) && !strandedTokenIds.has(token.id),
    );

    // Get IDs of preserved tokens to avoid duplicates
    const preservedTokenIds = new Set(currentPlayerTokens.map((t) => t.id));

    // The file's side of the same rule: a file token that one of the FILE's characters
    // points at stays only if a merged character still does. A seated player's live
    // character wins over the file's, and points at the live token — the file's token for
    // it would be a second one, with no character behind it, that the player controls.
    const fileCharacterTokenIds = new Set<string>();
    for (const character of normalizedCharacters) {
      if (character.tokenId) fileCharacterTokenIds.add(character.tokenId);
    }

    // Add loaded tokens that don't conflict with preserved ones. The uploaded
    // half is whitelist-coerced (S7) — tokens are otherwise copied verbatim
    // out of the least trustworthy source there is, straight into the vision
    // geometry. The live half is already ours, so it keeps its identity.
    const mergedTokens = [
      ...currentPlayerTokens,
      ...coerceTokenVisionRadii(
        (snapshot.tokens ?? []).filter(
          (token) =>
            !preservedTokenIds.has(token.id) &&
            (!fileCharacterTokenIds.has(token.id) || carriedTokenIds.has(token.id)),
        ),
      ),
    ];

    // A kept token's lock, scale and rotation live in its scene object, and the scene graph
    // is rebuilt from the list the merge hands it: the file's would replace the live one,
    // and a player's token would come back unlocked, unrotated, as the file had it.
    const keptSceneIds = new Set([...preservedTokenIds].map((id) => `token:${id}`));
    const sceneObjects = [
      ...(snapshot.sceneObjects ?? currentState.sceneObjects).filter(
        (object) => !keptSceneIds.has(object.id),
      ),
      ...currentState.sceneObjects.filter((object) => keptSceneIds.has(object.id)),
    ];

    const currentGridSquareSize = currentState.gridSquareSize ?? 5;

    // The drawings ALWAYS load. The scene graph builds drawing objects only FROM
    // `drawings` (SceneGraphBuilder), carrying each one's lock and offset over by id from
    // the scene objects above — so skipping them when the file had scene objects (every
    // backup and fork does) emptied the table's drawings on Restore table backup.
    const assetMap = buildAssetMap(snapshot);
    const mapBackground = resolveMapBackground(snapshot, assetMap);
    const drawings = resolveDrawings(snapshot, assetMap);

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
      customTokens: coerceCustomTokens(snapshot.customTokens),
      mapBackground,
      pointers: [], // Clear pointers on load
      drawings,
      gridSize: snapshot.gridSize ?? 50,
      gridSquareSize: snapshot.gridSquareSize ?? currentGridSquareSize,
      diceRolls: snapshot.diceRolls ?? [],
      // Whispers must not ride into a new table. The FORK path is safe by
      // construction (tableFork uses createSnapshot(), no recipient uid, so
      // visibleChatFor fails closed) — but the session-EXPORT path is not:
      // RoomMessageHandler builds the file with toSnapshot(state, true,
      // senderUid), so the exporting DM's own whispers survive the filter and
      // land in a file meant to be shared. Export strips them explicitly now;
      // this stays defensive because a session file is attacker-editable
      // regardless of how it was produced.
      chatLog: Array.isArray(snapshot.chatLog) ? snapshot.chatLog : [],
      drawingUndoStacks: {},
      drawingRedoStacks: {},
      sceneObjects,
      selectionState: createSelectionMap(),
      playerStagingZone: stagingManager.sanitize(snapshot.playerStagingZone),
      combatActive: snapshot.combatActive ?? false,
      currentTurnCharacterId: snapshot.currentTurnCharacterId ?? undefined,
      compiledScene: snapshot.compiledScene ?? undefined,
      mapTerrain: snapshot.mapTerrain ?? undefined,
      // These two were ABSENT from this literal, which meant Object.assign in
      // loadSnapshot left whatever the room already had. In-process that looks
      // like "preserved" and reads as harmless. Restoring onto a FRESH server —
      // the whole point of a session file, given the ephemeral filesystem — it
      // means "preserved nothing": walls and floor came back while every
      // authored tile, stamp and label stayed missing, with no error.
      //
      // The file is authoritative, exactly as it already is for compiledScene
      // and mapTerrain above; a session that restored some of the map and
      // silently kept the rest of the room's would be worse than either.
      mapElements: snapshot.mapElements ?? undefined,
      // Trusted only because the caller validates it against the documents it
      // actually restored — a binding to a missing document is not inert, it
      // makes the DM's editor open onto a 12s timeout. See handleLoadSession.
      liveMapDocumentId: snapshot.liveMapDocumentId ?? undefined,
      fogEnabled: snapshot.fogEnabled ?? false,
      // Whitelist-coerced: the file is attacker-editable, and the recipient
      // filter branches on this value.
      monsterHpDisplay: coerceMonsterHpDisplay(snapshot.monsterHpDisplay),
      // Same treatment: the distance maths branches on this value, and an
      // uploaded file is the least trustworthy source there is.
      diagonalRule: coerceDiagonalRule(snapshot.diagonalRule),
      // `=== true` because a session file is attacker-editable and this flag
      // ADMITS writes (PropDispatcher checks it): a truthy string must not
      // open the prop tools to the table. Absent (older files) reads as off.
      playerPropsEnabled: snapshot.playerPropsEnabled === true,
      // `!== false` because this flag defaults ON. It admits nothing a player
      // could not already do — manual entry is the pre-existing behaviour — so
      // unlike the line above, the risk of an edited file runs the other way:
      // `=== true` would silently disable it on every older session file.
      initiativeManualOverride: snapshot.initiativeManualOverride !== false,
      // Same clamp, for the least trustworthy source there is. Absent reads as
      // no default, which is how every session file written before now loads.
      defaultVisionRadius: coerceDefaultVisionRadius(snapshot.defaultVisionRadius),
      // FILE-AUTHORITATIVE, exactly like mapElements above: an atlas-free file
      // loads an EMPTY graph, never the room's current one — "preserved" here
      // would bleed campaign A's nodes (and, via document-id reuse, its
      // suspended scenes) into campaign B. Poison-proofed by the same helper
      // the disk loader uses.
      ...normalizeAtlasState({ atlasNodes: snapshot.atlasNodes, atlasLinks: snapshot.atlasLinks }),
      // ENVELOPE-only: the snapshot half of a session file never carries
      // scenes (plan §3's single-carriage rule). handleLoadSession installs
      // the envelope's validated copy AFTER this merge; a bare-snapshot load
      // (a fork, a legacy file) starts with none.
      sceneStates: {},
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
