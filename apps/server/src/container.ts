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
import { MapStudioService } from "./domains/mapStudio/service.js";
import { FileMapDocumentStore } from "./domains/mapStudio/fileStore.js";
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

  constructor(
    wss: WebSocketServer,
    authService: AuthService,
    roomRegistry?: RoomRegistry,
    mapStudioService?: MapStudioService,
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
    return this.getRouterForRoom(this.roomIdForUid(uid));
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
