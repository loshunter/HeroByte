// ============================================================================
// DEPENDENCY INJECTION CONTAINER
// ============================================================================
// Central container for service instantiation and dependency management
// Follows Inversion of Control (IoC) principle

import type { WebSocket, WebSocketServer } from "ws";
import { RoomService } from "./domains/room/service.js";
import { PlayerService } from "./domains/player/service.js";
import { TokenService } from "./domains/token/service.js";
import { MapService } from "./domains/map/service.js";
import { DiceService } from "./domains/dice/service.js";
import { CharacterService } from "./domains/character/service.js";
import { PropService } from "./domains/prop/service.js";
import { SelectionService } from "./domains/selection/service.js";
import { MessageRouter } from "./ws/messageRouter.js";
import { RateLimiter } from "./middleware/rateLimit.js";
import { AuthService } from "./domains/auth/service.js";
import { RoomRegistry } from "./domains/room/RoomRegistry.js";
import { isRoomStatePristine } from "./domains/room/roomStatePristine.js";
import { MapStudioService } from "./domains/mapStudio/service.js";
import { FileMapDocumentStore } from "./domains/mapStudio/fileStore.js";
import type { AssetService } from "./domains/assets/service.js";
import { getDefaultRoomId } from "./config/auth.js";

/**
 * Application container holding all services
 * Single source of truth for dependency management
 */
export class Container {
  // Domain services
  public readonly roomRegistry: RoomRegistry;
  public readonly roomService: RoomService;
  public readonly playerService: PlayerService;
  public readonly tokenService: TokenService;
  public readonly mapService: MapService;
  public readonly diceService: DiceService;
  public readonly characterService: CharacterService;
  public readonly propService: PropService;
  public readonly selectionService: SelectionService;
  public readonly authService: AuthService;
  public readonly mapStudioService: MapStudioService;

  // Middleware
  public readonly rateLimiter: RateLimiter;

  // Infrastructure
  public readonly messageRouter: MessageRouter;
  public readonly uidToWs: Map<string, WebSocket>;
  public readonly authenticatedUids: Set<string>;
  public readonly authenticatedSessions: Map<string, { roomId: string; authedAt: number }>;

  private readonly wss: WebSocketServer;
  private readonly defaultRoomId: string;
  // One MessageRouter per room: each router binds its room's RoomService,
  // broadcast debounce, and vision cache, so isolation is structural.
  private readonly routers = new Map<string, MessageRouter>();
  // Last time each room saw a routed message or a join, for idle unload.
  private readonly roomActivity = new Map<string, number>();

  /** Optional: without it, clearing the default table skips its uploads. */
  private readonly assetService?: AssetService;

  constructor(
    wss: WebSocketServer,
    authService: AuthService,
    roomRegistry?: RoomRegistry,
    mapStudioService?: MapStudioService,
    assetService?: AssetService,
  ) {
    // Initialize services (no dependencies between them).
    // A pre-hydrated RoomRegistry can be injected (bootstrap awaits
    // registry.whenReady() before constructing the container so Redis-backed
    // rooms are not initialized from empty state).
    this.wss = wss;
    this.defaultRoomId = getDefaultRoomId();
    this.roomRegistry = roomRegistry ?? new RoomRegistry({ defaultRoomId: this.defaultRoomId });
    this.playerService = new PlayerService();
    this.tokenService = new TokenService();
    this.mapService = new MapService();
    this.diceService = new DiceService();
    this.characterService = new CharacterService();
    this.propService = new PropService();
    this.selectionService = new SelectionService();
    this.authService = authService;
    this.mapStudioService = mapStudioService ?? new MapStudioService(new FileMapDocumentStore());
    this.assetService = assetService;

    // Initialize middleware
    this.rateLimiter = new RateLimiter({ maxMessages: 100, windowMs: 1000 });

    // Initialize WebSocket connection tracking
    this.uidToWs = new Map<string, WebSocket>();
    this.authenticatedUids = new Set<string>();
    this.authenticatedSessions = new Map<string, { roomId: string; authedAt: number }>();

    // The default room's runtime doubles as the legacy single-room surface.
    this.roomService = this.getRoomServiceForRoom(this.defaultRoomId);
    this.roomService.loadState();
    this.messageRouter = this.getRouterForRoom(this.defaultRoomId);
    // Start the default table's idle clock at boot. Without this its activity
    // reads as 0 (the epoch), so the first sweep after a restart would judge a
    // table nobody has joined yet as long-idle and wipe state that had just
    // been loaded from disk.
    this.touchRoomActivity(this.defaultRoomId);
    this.markDefaultTableAsPublic();
  }

  /**
   * Mark the default table as the public test table so the UI can label it.
   *
   * It is public because it IS the default table — the one whose credentials
   * every server publishes — not because of what its password happens to be.
   * That password cannot be changed (RoomMessageHandler refuses), precisely so
   * nobody can padlock a host's own test bed.
   */
  private markDefaultTableAsPublic(): void {
    const roomService = this.roomRegistry.get(this.defaultRoomId);
    if (roomService.getState().isPublicTable === true) return;
    roomService.setState({ isPublicTable: true });
  }

  /**
   * The room a uid is authenticated into (default room until then).
   */
  roomIdForUid(uid: string): string {
    return this.authenticatedSessions.get(uid)?.roomId ?? this.defaultRoomId;
  }

  /**
   * RoomService for a room, creating (and disk-loading) it on first use.
   */
  getRoomServiceForRoom(roomId: string): RoomService {
    return this.roomRegistry.get(roomId);
  }

  /**
   * The per-room MessageRouter, created lazily alongside its RoomService.
   */
  getRouterForRoom(roomId: string): MessageRouter {
    let router = this.routers.get(roomId);
    if (!router) {
      router = new MessageRouter(
        this.getRoomServiceForRoom(roomId),
        this.playerService,
        this.tokenService,
        this.mapService,
        this.diceService,
        this.characterService,
        this.propService,
        this.selectionService,
        this.authService,
        this.wss,
        this.uidToWs,
        () => this.getAuthenticatedClientsForRoom(roomId),
        this.mapStudioService,
        (uid) => this.roomIdForUid(uid),
      );
      this.routers.set(roomId, router);
    }
    return router;
  }

  /** Route a message through the sender's room. */
  routerForUid(uid: string): MessageRouter {
    const roomId = this.roomIdForUid(uid);
    this.touchRoomActivity(roomId);
    return this.getRouterForRoom(roomId);
  }

  /** Record activity so the idle sweeper leaves the room alone. */
  touchRoomActivity(roomId: string): void {
    this.roomActivity.set(roomId, Date.now());
  }

  /**
   * Unload rooms that have been idle with no connected players. Their state
   * is flushed to durable storage first and restored on the next join. The
   * default room is never unloaded (it backs the legacy single-room surface).
   */
  async unloadIdleRooms(idleMs: number): Promise<string[]> {
    const now = Date.now();
    const unloaded: string[] = [];
    for (const roomId of this.roomRegistry.listRooms()) {
      if (roomId === this.defaultRoomId) continue;
      if (this.getAuthenticatedClientsForRoom(roomId).size > 0) continue;
      const lastActivity = this.roomActivity.get(roomId) ?? 0;
      if (now - lastActivity < idleMs) continue;

      const roomService = this.roomRegistry.get(roomId);
      roomService.saveState();
      await roomService.awaitPendingWrites();
      // The await above is this sweep's ONLY yield point, and a client can
      // authenticate into the room DURING it: the join runs synchronously,
      // mutates this same RoomService, and queues a state write the awaited
      // promise does not cover (the queue promise was captured at call time).
      // Re-check both guards before tearing down — a join marks the session
      // AND touches roomActivity, so either re-check catches it. Without
      // this, the room unloads under an authenticated client and the orphaned
      // write races the lazily-recreated service's writes on the SAME state
      // file (torn JSON → the room reloads empty).
      if (this.getAuthenticatedClientsForRoom(roomId).size > 0) continue;
      if ((this.roomActivity.get(roomId) ?? 0) !== lastActivity) continue;
      this.routers.delete(roomId);
      this.roomRegistry.unload(roomId);
      this.roomActivity.delete(roomId);
      unloaded.push(roomId);
    }
    if (unloaded.length > 0) {
      console.log(`[Container] Unloaded ${unloaded.length} idle room(s): ${unloaded.join(", ")}`);
    }
    return unloaded;
  }

  /**
   * Wipe the default table (Main Hall) once it has sat empty.
   *
   * It is a PUBLIC scratch space — anyone holding the shared password is in it
   * — and it is deliberately never unloaded, because it backs the legacy
   * single-room surface. That combination means whatever anyone leaves behind
   * (tokens, maps, and above all uploaded images) accumulated forever against
   * its 50MB asset quota; on the free tier the spin-down hid that, but on a
   * persistent disk it is permanent, and a full quota returns 507 to every
   * upload in that table from then on. Clearing it when nobody is there keeps
   * the shared space usable without ever interrupting a session.
   *
   * Private tables are untouched: they unload (preserving durable state) via
   * unloadIdleRooms instead. Only this table is ever wiped, and it always is —
   * its password cannot be changed, so it can never quietly become someone's
   * real table. Anyone wanting to keep what they built forks it to a private
   * table (fork-table), which copies it across before the next sweep.
   */
  async clearIdleDefaultRoom(idleMs: number): Promise<boolean> {
    // A zero/negative window means "never clear" (an operator opting out via
    // HEROBYTE_DEFAULT_ROOM_CLEAR_HOURS=0). Enforced here as well as at the
    // call site, because read literally a 0 window makes every sweep overdue —
    // the failure mode is destroying the table continuously.
    if (idleMs <= 0) return false;

    const roomId = this.defaultRoomId;
    if (this.getAuthenticatedClientsForRoom(roomId).size > 0) return false;
    const lastActivity = this.roomActivity.get(roomId) ?? 0;
    if (Date.now() - lastActivity < idleMs) return false;

    const roomService = this.roomRegistry.get(roomId);
    if (isRoomStatePristine(roomService.getState())) return false;

    // No await between the guards above and this reset, so a client cannot
    // slip in and have the table wiped out from under them mid-session.
    roomService.resetState();
    this.mapStudioService.resetRoom(roomId);
    this.roomActivity.set(roomId, Date.now());

    let freedBytes = 0;
    if (this.assetService) {
      try {
        freedBytes = await this.assetService.releaseRoom(roomId);
      } catch (error) {
        // The table itself is already clear; a failed upload sweep costs disk,
        // not correctness, and the next sweep retries it.
        console.error("[Container] Failed to release default-table assets", error);
      }
    }

    console.log(
      `[Container] Cleared idle default table "${roomId}"` +
        (freedBytes > 0 ? ` (freed ${Math.round(freedBytes / 1024)}KB of uploads)` : ""),
    );
    return true;
  }

  /**
   * Clean up resources on shutdown
   */
  destroy(): void {
    // Clear connection tracking
    this.uidToWs.clear();
    this.authenticatedUids.clear();
    this.authenticatedSessions.clear();
    this.routers.clear();

    // Future: Add any cleanup logic for services
    void this.roomRegistry.destroy();
    void this.mapStudioService.flush();
  }

  resetForE2E(): void {
    if (this.getAuthenticatedClients().size > 0) {
      throw new Error("Cannot reset E2E state while clients are connected");
    }
    this.uidToWs.clear();
    this.authenticatedUids.clear();
    this.authenticatedSessions.clear();
    for (const roomId of this.roomRegistry.listRooms()) {
      this.roomRegistry.get(roomId).resetState();
      this.mapStudioService.resetRoom(roomId);
    }
  }

  /**
   * Collect WebSocket clients that have completed authentication
   */
  getAuthenticatedClients(): Set<WebSocket> {
    const clients = new Set<WebSocket>();
    for (const uid of this.authenticatedUids) {
      const ws = this.uidToWs.get(uid);
      if (ws && ws.readyState === 1) {
        clients.add(ws);
      }
    }
    return clients;
  }

  /**
   * Authenticated clients belonging to one room — the only set a room's
   * broadcasts may ever reach.
   */
  getAuthenticatedClientsForRoom(roomId: string): Set<WebSocket> {
    const clients = new Set<WebSocket>();
    for (const uid of this.authenticatedUids) {
      if (this.roomIdForUid(uid) !== roomId) continue;
      const ws = this.uidToWs.get(uid);
      if (ws && ws.readyState === 1) {
        clients.add(ws);
      }
    }
    return clients;
  }
}
