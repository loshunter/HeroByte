import type { Redis } from "ioredis";
import {
  coerceDefaultVisionRadius,
  coerceDiagonalRule,
  coerceMonsterHpDisplay,
  coerceTokenVisionRadii,
  type Player,
} from "@herobyte/shared";
import { normalizeAtlasState } from "../atlasState.js";
import { createSelectionMap, type RoomState } from "../../room/model.js";
import {
  coerceCombatRound,
  coerceCustomTokens,
  coerceLoadedCharacters,
} from "../persistence/loadCoercions.js";
import { sanitizeStagingZone } from "../staging/StagingZoneManager.js";
import type { RoomStore } from "./RoomStore.js";

export interface RedisRoomStoreOptions {
  client: Pick<Redis, "hget" | "hset" | "hdel" | "hkeys">;
  namespace?: string;
}

/**
 * RedisRoomStore keeps a synchronous in-memory cache backed by a Redis hash.
 * Consumers must call hydrate() during startup to load existing room states.
 */
export class RedisRoomStore implements RoomStore {
  private readonly client: RedisRoomStoreOptions["client"];
  private readonly namespace: string;
  private cache = new Map<string, RoomState>();

  constructor(options: RedisRoomStoreOptions) {
    this.client = options.client;
    this.namespace = options.namespace ?? "room:state";
  }

  async hydrate(): Promise<void> {
    const roomIds = await this.client.hkeys(this.namespace);
    await Promise.all(
      roomIds.map(async (roomId) => {
        const payload = await this.client.hget(this.namespace, roomId);
        if (!payload) {
          return;
        }
        try {
          const parsed = JSON.parse(payload) as RoomState;
          // THE THIRD LOAD DOOR. This used to spread the payload verbatim and
          // normalise only the three atlas fields, so every whitelist the disk
          // loader applies was bypassed by a Redis-backed table. Dark today
          // (ROOM_STORE is unset) and scheduled to open: VISION.md makes
          // ROOM_STORE=redis the production default at the Rooms milestone.
          //
          // FIELD FOR FIELD with StatePersistence.loadFromDisk — the first
          // repair mirrored six fields and called that "the same field set",
          // and a reviewer's line-by-line found defaultVisionRadius (a
          // whitelist clamp applied at both other doors), the diceRolls/chatLog
          // array guards (a poisoned non-array is walked in the debounced
          // broadcast timer, outside route()'s try/catch, and kills the
          // process on every restart), the players map, and the ephemera —
          // which matter MORE here than at the disk door, because persist()
          // writes the whole RoomState, users and undo stacks included, where
          // the disk writer picks a list. Keep this literal in step with the
          // disk loader's; a field with a domain added to one belongs in both.
          const parsedPlayers: Player[] = Array.isArray(parsed.players) ? parsed.players : [];
          const state: RoomState = {
            users: [],
            stateVersion: typeof parsed.stateVersion === "number" ? parsed.stateVersion : 0,
            tokens: coerceTokenVisionRadii(Array.isArray(parsed.tokens) ? parsed.tokens : []),
            players: parsedPlayers.map((player) => ({
              ...player,
              isDM: player.isDM ?? false,
              statusEffects: Array.isArray(player.statusEffects) ? [...player.statusEffects] : [],
            })),
            characters: coerceLoadedCharacters(parsed.characters, parsed.combatActive === true),
            props: parsed.props || [],
            customTokens: coerceCustomTokens(parsed.customTokens),
            mapBackground: parsed.mapBackground,
            pointers: [],
            drawings: parsed.drawings || [],
            gridSize: parsed.gridSize || 50,
            gridSquareSize: parsed.gridSquareSize || 5,
            diceRolls: Array.isArray(parsed.diceRolls) ? parsed.diceRolls : [],
            chatLog: Array.isArray(parsed.chatLog) ? parsed.chatLog : [],
            drawingUndoStacks: {},
            drawingRedoStacks: {},
            sceneObjects: parsed.sceneObjects || [],
            selectionState: createSelectionMap(),
            playerStagingZone: sanitizeStagingZone(parsed.playerStagingZone),
            combatActive: parsed.combatActive ?? false,
            combatRound: coerceCombatRound(parsed.combatRound),
            currentTurnCharacterId: parsed.currentTurnCharacterId ?? undefined,
            compiledScene: parsed.compiledScene ?? undefined,
            mapTerrain: parsed.mapTerrain ?? undefined,
            mapElements: parsed.mapElements ?? undefined,
            liveMapDocumentId: parsed.liveMapDocumentId ?? undefined,
            fogEnabled: parsed.fogEnabled ?? false,
            monsterHpDisplay: coerceMonsterHpDisplay(parsed.monsterHpDisplay),
            diagonalRule: coerceDiagonalRule(parsed.diagonalRule),
            playerPropsEnabled: parsed.playerPropsEnabled === true,
            initiativeManualOverride: parsed.initiativeManualOverride !== false,
            defaultVisionRadius: coerceDefaultVisionRadius(parsed.defaultVisionRadius),
            ...normalizeAtlasState(parsed),
          };
          this.cache.set(roomId, state);
        } catch (error) {
          console.warn(`[RedisRoomStore] Failed to parse cached state for ${roomId}`, error);
        }
      }),
    );
  }

  get(roomId: string): RoomState | undefined {
    return this.cache.get(roomId);
  }

  set(roomId: string, state: RoomState): void {
    this.cache.set(roomId, state);
    this.persist(roomId, state);
  }

  delete(roomId: string): void {
    this.cache.delete(roomId);
    void this.client.hdel(this.namespace, roomId).catch((error) => {
      console.error(`[RedisRoomStore] Failed to delete room ${roomId} from Redis`, error);
    });
  }

  // Deliberately keeps the cache entry: reads are synchronous, so a room
  // evicted from this cache could not be restored without an async re-hydrate
  // — and a recreated RoomService would overwrite Redis with empty state.
  // Idle unload therefore only drops the RoomService/router for Redis-backed
  // rooms; freeing the cache needs hydrate-on-demand (follow-up).
  evict(_roomId: string): void {}

  listRoomIds(): string[] {
    return Array.from(this.cache.keys());
  }

  private persist(roomId: string, state: RoomState): void {
    const payload = JSON.stringify(state);
    void this.client
      .hset(this.namespace, roomId, payload)
      .catch((error) => console.error(`[RedisRoomStore] Failed to persist room ${roomId}`, error));
  }
}
