// ============================================================================
// DEPENDENCY INJECTION CONTAINER
// ============================================================================
// Central container for service instantiation and dependency management
// Follows Inversion of Control (IoC) principle

import type { WebSocketServer } from "ws";
import { RoomService } from "./domains/room/service.js";
import { PlayerService } from "./domains/player/service.js";
import { TokenService } from "./domains/token/service.js";
import { MapService } from "./domains/map/service.js";
import { DiceService } from "./domains/dice/service.js";
import { CharacterService } from "./domains/character/service.js";
import { MessageRouter } from "./ws/messageRouter.js";
import { RateLimiter } from "./middleware/rateLimit.js";

/**
 * Application container holding all services
 * Single source of truth for dependency management
 */
export class Container {
  // Domain services
  public readonly roomService: RoomService;
  public readonly playerService: PlayerService;
  public readonly tokenService: TokenService;
  public readonly mapService: MapService;
  public readonly diceService: DiceService;
  public readonly characterService: CharacterService;

  // Middleware
  public readonly rateLimiter: RateLimiter;

  // Infrastructure
  public readonly messageRouter: MessageRouter;
  public readonly uidToWs: Map<string, any>;

  constructor(wss: WebSocketServer) {
    // Initialize services (no dependencies between them)
    this.roomService = new RoomService();
    this.playerService = new PlayerService();
    this.tokenService = new TokenService();
    this.mapService = new MapService();
    this.diceService = new DiceService();
    this.characterService = new CharacterService();

    // Initialize middleware
    this.rateLimiter = new RateLimiter({ maxMessages: 100, windowMs: 1000 });

    // Initialize WebSocket connection tracking
    this.uidToWs = new Map<string, any>();

    // Initialize message router (depends on services)
    this.messageRouter = new MessageRouter(
      this.roomService,
      this.playerService,
      this.tokenService,
      this.mapService,
      this.diceService,
      this.characterService,
      wss,
      this.uidToWs
    );

    // Load persisted state
    this.roomService.loadState();
  }

  /**
   * Clean up resources on shutdown
   */
  destroy(): void {
    // Clear connection tracking
    this.uidToWs.clear();

    // Future: Add any cleanup logic for services
  }
}
