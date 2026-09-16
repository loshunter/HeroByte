import type { Redis } from "ioredis";
import {
  coerceDiagonalRule,
  coerceMonsterHpDisplay,
  coerceTokenVisionRadii,
} from "@herobyte/shared";
import { normalizeAtlasState } from "../atlasState.js";
import { createSelectionMap, type RoomState } from "../../room/model.js";
import {
  coerceCombatRound,
  coerceCustomTokens,
  coerceLoadedCharacters,
} from "../persistence/loadCoercions.js";
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
          // loader applies — a stance off the list, a custom token whose
          // picture the wire would refuse, a token size off the ladder — was
          // bypassed by a Redis-backed table. Dark today (ROOM_STORE is unset)
          // and scheduled to open: VISION.md makes ROOM_STORE=redis the
          // production default at the Rooms milestone. The same field set
          // StatePersistence.loadFromDisk coerces, in the same shape; the
          // ephemera reset (selectionState is a Map and round-trips Redis as
          // `{}`, which would break its serializer at broadcast) is the reset
          // discipline the old comment named as the real fix and did not do.
          const state: RoomState = {
            ...parsed,
            tokens: coerceTokenVisionRadii(Array.isArray(parsed.tokens) ? parsed.tokens : []),
            characters: coerceLoadedCharacters(parsed.characters, parsed.combatActive === true),
            customTokens: coerceCustomTokens(parsed.customTokens),
            combatRound: coerceCombatRound(parsed.combatRound),
            monsterHpDisplay: coerceMonsterHpDisplay(parsed.monsterHpDisplay),
            diagonalRule: coerceDiagonalRule(parsed.diagonalRule),
            selectionState: createSelectionMap(),
            pointers: [],
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
