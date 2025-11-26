import type { Redis } from "ioredis";
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
          const state = JSON.parse(payload) as RoomState;
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
