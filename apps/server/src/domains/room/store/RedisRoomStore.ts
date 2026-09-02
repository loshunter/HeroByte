import type { Redis } from "ioredis";
import { normalizeAtlasState } from "../atlasState.js";
import type { RoomState } from "../../room/model.js";
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
          // Covers the THREE ATLAS FIELDS ONLY: a pre-Atlas payload lacks the
          // required graph fields, and this hydrate has no other compat layer.
          // The rest of the payload is still hydrated as-is — notably
          // `selectionState` (a Map) round-trips Redis as `{}` and would break
          // its serializer at broadcast time — a pre-existing gap of this
          // opt-in store, NOT closed here. A real fix is the disk loader's
          // full reset discipline (createSelectionMap, cleared ephemera).
          const state: RoomState = { ...parsed, ...normalizeAtlasState(parsed) };
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
