import { Redis } from "ioredis";
import { resolveServerPath } from "../../config/serverPaths.js";
import { RoomService } from "./service.js";
import type { RoomStore } from "./store/RoomStore.js";
import { InMemoryRoomStore } from "./store/RoomStore.js";
import { RedisRoomStore } from "./store/RedisRoomStore.js";
import type { BroadcastMetricsLogger } from "./metrics/BroadcastMetricsLogger.js";

export interface RoomRegistryOptions {
  store?: RoomStore;
  metricsLoggerFactory?: () => BroadcastMetricsLogger;
  /** Room whose state file stays the legacy ./herobyte-state.json path. */
  defaultRoomId?: string;
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
  private readonly defaultRoomId?: string;
  private redisClient: Redis | null = null;
  private hydration: Promise<void> = Promise.resolve();

  constructor(options: RoomRegistryOptions = {}) {
    this.metricsLoggerFactory = options.metricsLoggerFactory;
    this.defaultRoomId = options.defaultRoomId;
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
        stateFile: this.stateFileFor(roomId),
      });
      this.services.set(roomId, service);
      // In multi-room mode (defaultRoomId configured) every room restores its
      // own disk state on first request; the default room keeps the legacy
      // ./herobyte-state.json (or ROOM_STATE_FILE). Legacy single-room
      // callers load state explicitly, as before.
      if (this.defaultRoomId) {
        service.loadState();
      }
    }
    return service;
  }

  private stateFileFor(roomId: string): string | undefined {
    if (!this.defaultRoomId || roomId === this.defaultRoomId) {
      return undefined; // legacy path / env override
    }
    const safe = roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
    // Anchored like the default store: per-room files must not fork when the
    // server is launched from a different CWD.
    return resolveServerPath(`herobyte-state.${safe}.json`);
  }

  delete(roomId: string): void {
    this.services.delete(roomId);
  }

  /**
   * Drop a room's service and in-memory state, keeping durable storage so the
   * next get() restores it (from its state file, or Redis for redis-backed
   * stores). Used by idle-room unload.
   */
  unload(roomId: string): void {
    this.services.delete(roomId);
    this.store.evict(roomId);
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
