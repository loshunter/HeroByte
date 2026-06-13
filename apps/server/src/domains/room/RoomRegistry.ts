import { Redis } from "ioredis";
import { RoomService } from "./service.js";
import type { RoomStore } from "./store/RoomStore.js";
import { InMemoryRoomStore } from "./store/RoomStore.js";
import { RedisRoomStore } from "./store/RedisRoomStore.js";
import type { BroadcastMetricsLogger } from "./metrics/BroadcastMetricsLogger.js";

export interface RoomRegistryOptions {
  store?: RoomStore;
  metricsLoggerFactory?: () => BroadcastMetricsLogger;
}

/**
 * RoomRegistry hands out RoomService instances keyed by roomId. It centralizes
 * store selection (in-memory vs Redis) so multi-room fan-out can be managed
 * without duplicating bootstrap logic.
 */
export class RoomRegistry {
  private readonly services = new Map<string, RoomService>();
  private readonly store: RoomStore;
  private readonly metricsLoggerFactory?: () => BroadcastMetricsLogger;
  private redisClient: Redis | null = null;
  private hydration: Promise<void> = Promise.resolve();

  constructor(options: RoomRegistryOptions = {}) {
    this.metricsLoggerFactory = options.metricsLoggerFactory;
    this.store = options.store ?? this.initializeStore();
  }

  /**
   * Resolves once the backing store has finished hydrating (e.g. Redis cache
   * warm-up). Callers MUST await this before requesting RoomService instances
   * at startup — creating a service for a room before hydration completes
   * would initialize it with empty state and overwrite the persisted copy.
   */
  whenReady(): Promise<void> {
    return this.hydration;
  }

  get(roomId: string): RoomService {
    if (!roomId) {
      throw new Error("roomId is required");
    }
    let service = this.services.get(roomId);
    if (!service) {
      service = new RoomService({
        store: this.store,
        roomId,
        metricsLogger: this.metricsLoggerFactory?.(),
      });
      this.services.set(roomId, service);
    }
    return service;
  }

  delete(roomId: string): void {
    this.services.delete(roomId);
  }

  listRooms(): string[] {
    return Array.from(this.services.keys());
  }

  async destroy(): Promise<void> {
    this.services.clear();
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }

  private initializeStore(): RoomStore {
    if (process.env.ROOM_STORE === "redis") {
      try {
        const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
        this.redisClient = new Redis(url);
        const redisStore = new RedisRoomStore({ client: this.redisClient });
        // Track hydration so bootstrap can await it (see whenReady). Previously
        // this was fire-and-forget, so a RoomService created before hydration
        // finished would silently start from (and persist) empty state.
        this.hydration = redisStore.hydrate().catch((error) => {
          console.error("[RoomRegistry] Failed to hydrate RedisRoomStore", error);
        });
        return redisStore;
      } catch (error) {
        console.error("[RoomRegistry] Unable to initialize Redis store", error);
        this.redisClient = null;
      }
    }
    return new InMemoryRoomStore();
  }
}
