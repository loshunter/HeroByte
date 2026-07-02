// ============================================================================
// WEBSOCKET MESSAGE ROUTER
// ============================================================================
// Routes incoming WebSocket messages to appropriate domain services

import type { WebSocket, WebSocketServer } from "ws";
import {
  gridCellToWorldPoint,
  type ClientMessage,
  type DragPreviewEvent,
  type Pointer,
  type ScenePoint,
  type ServerMessage,
} from "@herobyte/shared";
import {
  createVisionContext,
  getHiddenNpcTokenIds,
  isWorldPointVisible,
  visionSignature,
  type VisionContext,
} from "../domains/room/scene/visionFilter.js";
import { isCommandAckEnabled } from "../config/featureFlags.js";
import { RoomService } from "../domains/room/service.js";
import { PlayerService } from "../domains/player/service.js";
import { TokenService } from "../domains/token/service.js";
import { MapService } from "../domains/map/service.js";
import { DiceService } from "../domains/dice/service.js";
import { CharacterService } from "../domains/character/service.js";
import { PropService } from "../domains/prop/service.js";
import { SelectionService } from "../domains/selection/service.js";
import { AuthService } from "../domains/auth/service.js";
import { MapStudioService } from "../domains/mapStudio/service.js";
import { HeartbeatHandler } from "./handlers/HeartbeatHandler.js";
import { RTCSignalHandler } from "./handlers/RTCSignalHandler.js";
import { PointerHandler, type PointerHandlerResult } from "./handlers/PointerHandler.js";
import { TokenMessageHandler } from "./handlers/TokenMessageHandler.js";
import { CharacterMessageHandler } from "./handlers/CharacterMessageHandler.js";
import { NPCMessageHandler } from "./handlers/NPCMessageHandler.js";
import { PropMessageHandler } from "./handlers/PropMessageHandler.js";
import { PlayerMessageHandler } from "./handlers/PlayerMessageHandler.js";
import { InitiativeMessageHandler } from "./handlers/InitiativeMessageHandler.js";
import { MapMessageHandler } from "./handlers/MapMessageHandler.js";
import { DrawingMessageHandler } from "./handlers/DrawingMessageHandler.js";
import { SelectionMessageHandler } from "./handlers/SelectionMessageHandler.js";
import { DiceMessageHandler } from "./handlers/DiceMessageHandler.js";
import { RoomMessageHandler } from "./handlers/RoomMessageHandler.js";
import { TransformMessageHandler } from "./handlers/TransformMessageHandler.js";
import { MapStudioMessageHandler } from "./handlers/MapStudioMessageHandler.js";
import { SceneMessageHandler } from "./handlers/SceneMessageHandler.js";
import { AuthorizationService } from "./services/AuthorizationService.js";
import { MessageErrorHandler } from "./services/MessageErrorHandler.js";
import { BroadcastService } from "./services/BroadcastService.js";
import { DirectMessageService } from "./services/DirectMessageService.js";
import { RouteResultHandler, type RouteHandlerResult } from "./services/RouteResultHandler.js";
import { TokenDispatcher } from "./dispatchers/TokenDispatcher.js";
import { CharacterDispatcher } from "./dispatchers/CharacterDispatcher.js";
import { PlayerDispatcher } from "./dispatchers/PlayerDispatcher.js";
import { MapDispatcher } from "./dispatchers/MapDispatcher.js";
import { PropDispatcher } from "./dispatchers/PropDispatcher.js";
import { InitiativeDispatcher } from "./dispatchers/InitiativeDispatcher.js";
import { SelectionDispatcher } from "./dispatchers/SelectionDispatcher.js";
import { DiceDispatcher } from "./dispatchers/DiceDispatcher.js";
import { RoomDispatcher } from "./dispatchers/RoomDispatcher.js";
import { DMAuthorizationEnforcer } from "./services/DMAuthorizationEnforcer.js";
import { AuthorizationCheckWrapper } from "./services/AuthorizationCheckWrapper.js";
import { MessageLogger } from "./services/MessageLogger.js";
import { MessageRoutingContext } from "./services/MessageRoutingContext.js";
import type { PendingDelta } from "./types.js";

/**
 * Message router - handles all WebSocket messages and dispatches to domain services
 */
export class MessageRouter {
  private roomService: RoomService;
  private authorizationService: AuthorizationService;
  private messageErrorHandler: MessageErrorHandler;
  private broadcastService: BroadcastService;
  private directMessageService: DirectMessageService;
  private routeResultHandler: RouteResultHandler;
  private dmAuthorizationEnforcer: DMAuthorizationEnforcer;
  private authorizationCheckWrapper: AuthorizationCheckWrapper;
  private messageLogger: MessageLogger;
  private messageRoutingContext: MessageRoutingContext;
  private playerService: PlayerService;
  private tokenService: TokenService;
  private mapService: MapService;
  private diceService: DiceService;
  private characterService: CharacterService;
  private propService: PropService;
  private selectionService: SelectionService;
  private authService: AuthService;
  private heartbeatHandler: HeartbeatHandler;
  private rtcSignalHandler: RTCSignalHandler;
  private pointerHandler: PointerHandler;
  private tokenMessageHandler: TokenMessageHandler;
  private characterMessageHandler: CharacterMessageHandler;
  private npcMessageHandler: NPCMessageHandler;
  private propMessageHandler: PropMessageHandler;
  private playerMessageHandler: PlayerMessageHandler;
  private initiativeMessageHandler: InitiativeMessageHandler;
  private mapMessageHandler: MapMessageHandler;
  private drawingMessageHandler: DrawingMessageHandler;
  private selectionMessageHandler: SelectionMessageHandler;
  private diceMessageHandler: DiceMessageHandler;
  private roomMessageHandler: RoomMessageHandler;
  private transformMessageHandler: TransformMessageHandler;
  private mapStudioMessageHandler: MapStudioMessageHandler;
  private sceneMessageHandler: SceneMessageHandler;
  private tokenDispatcher: TokenDispatcher;
  private characterDispatcher: CharacterDispatcher;
  private playerDispatcher: PlayerDispatcher;
  private mapDispatcher: MapDispatcher;
  private propDispatcher: PropDispatcher;
  private initiativeDispatcher: InitiativeDispatcher;
  private selectionDispatcher: SelectionDispatcher;
  private diceDispatcher: DiceDispatcher;
  private roomDispatcher: RoomDispatcher;
  private wss: WebSocketServer;
  private uidToWs: Map<string, WebSocket>;
  private getAuthorizedClients: () => Set<WebSocket>;
  private getRoomIdForUid: (uid: string) => string;
  private skipNextBroadcastVersionBump: boolean = false;
  // Per-recipient vision, memoized on a signature of its actual inputs (own
  // token cells, door states, map transform, grid, scene identity). Other
  // players' moves and drag previews leave the signature untouched, so a
  // whole drag — and every unrelated delta — reuses the cached polygons.
  private visionCache = new Map<string, { signature: string; context: VisionContext | null }>();

  constructor(
    roomService: RoomService,
    playerService: PlayerService,
    tokenService: TokenService,
    mapService: MapService,
    diceService: DiceService,
    characterService: CharacterService,
    propService: PropService,
    selectionService: SelectionService,
    authService: AuthService,
    wss: WebSocketServer,
    uidToWs: Map<string, WebSocket>,
    getAuthorizedClients: () => Set<WebSocket>,
    mapStudioService: MapStudioService = new MapStudioService(),
    getRoomIdForUid: (uid: string) => string = () => "default",
  ) {
    this.roomService = roomService;
    this.playerService = playerService;
    this.tokenService = tokenService;
    this.mapService = mapService;
    this.diceService = diceService;
    this.characterService = characterService;
    this.propService = propService;
    this.selectionService = selectionService;
    this.authService = authService;
    this.wss = wss;
    this.uidToWs = uidToWs;
    this.getAuthorizedClients = getAuthorizedClients;
    this.getRoomIdForUid = getRoomIdForUid;
    this.authorizationService = new AuthorizationService();
    this.messageLogger = new MessageLogger();
    this.messageErrorHandler = new MessageErrorHandler(this.messageLogger);
    this.broadcastService = new BroadcastService();
    this.directMessageService = new DirectMessageService(uidToWs);
    this.routeResultHandler = new RouteResultHandler(
      (reason) => this.broadcast(reason),
      () => this.roomService.saveState(),
    );
    this.dmAuthorizationEnforcer = new DMAuthorizationEnforcer(this.messageLogger);
    this.authorizationCheckWrapper = new AuthorizationCheckWrapper(this.dmAuthorizationEnforcer);
    this.messageRoutingContext = new MessageRoutingContext(
      this.roomService,
      this.authorizationService,
    );
    this.heartbeatHandler = new HeartbeatHandler();
    this.rtcSignalHandler = new RTCSignalHandler(
      uidToWs,
      (fromUid, targetUid) => this.getRoomIdForUid(fromUid) === this.getRoomIdForUid(targetUid),
    );
    this.pointerHandler = new PointerHandler(mapService);
    this.tokenMessageHandler = new TokenMessageHandler(
      tokenService,
      characterService,
      selectionService,
      roomService,
    );
    this.tokenDispatcher = new TokenDispatcher(
      this.tokenMessageHandler,
      this.authorizationCheckWrapper,
    );
    this.characterMessageHandler = new CharacterMessageHandler(
      characterService,
      tokenService,
      selectionService,
      roomService,
    );
    this.npcMessageHandler = new NPCMessageHandler(
      characterService,
      tokenService,
      selectionService,
    );
    this.characterDispatcher = new CharacterDispatcher(
      this.characterMessageHandler,
      this.npcMessageHandler,
      this.authorizationCheckWrapper,
    );
    this.propMessageHandler = new PropMessageHandler(propService, selectionService);
    this.propDispatcher = new PropDispatcher(
      this.propMessageHandler,
      this.authorizationCheckWrapper,
    );
    this.playerMessageHandler = new PlayerMessageHandler(playerService, roomService);
    this.playerDispatcher = new PlayerDispatcher(this.playerMessageHandler);
    this.initiativeMessageHandler = new InitiativeMessageHandler(characterService, roomService);
    this.initiativeDispatcher = new InitiativeDispatcher(this.initiativeMessageHandler);
    this.mapMessageHandler = new MapMessageHandler(mapService, roomService);
    this.drawingMessageHandler = new DrawingMessageHandler(
      mapService,
      selectionService,
      roomService,
    );
    this.mapDispatcher = new MapDispatcher(
      this.mapMessageHandler,
      this.pointerHandler,
      this.drawingMessageHandler,
    );
    this.selectionMessageHandler = new SelectionMessageHandler(selectionService, roomService);
    this.selectionDispatcher = new SelectionDispatcher(this.selectionMessageHandler);
    this.diceMessageHandler = new DiceMessageHandler(diceService);
    this.diceDispatcher = new DiceDispatcher(this.diceMessageHandler);
    this.roomMessageHandler = new RoomMessageHandler(
      roomService,
      authService,
      (targetUid, message) => this.sendControlMessage(targetUid, message),
      (uid) => this.getRoomIdForUid(uid),
    );
    this.transformMessageHandler = new TransformMessageHandler(roomService);
    this.roomDispatcher = new RoomDispatcher(
      this.roomMessageHandler,
      this.heartbeatHandler,
      this.rtcSignalHandler,
      this.transformMessageHandler,
      this.tokenMessageHandler,
      this.roomService,
      this.authorizationCheckWrapper,
      (targetUid, message) => this.sendControlMessage(targetUid, message),
    );
    this.mapStudioMessageHandler = new MapStudioMessageHandler(
      mapStudioService,
      (targetUid, message) => this.sendControlMessage(targetUid, message),
      (roomId, message) => this.sendMapStudioMessageToDMs(roomId, message),
      () => this.roomService.getState(),
    );
    this.sceneMessageHandler = new SceneMessageHandler(() => this.roomService.getState());
  }

  /**
   * Route a message to the appropriate handler
   */
  route(message: ClientMessage, senderUid: string): void {
    this.messageLogger.logMessageRouting(message.t, senderUid);
    const context = this.messageRoutingContext.create(senderUid);

    try {
      // Delegate to TokenDispatcher
      const tokenResult = this.tokenDispatcher.dispatch(message, context, senderUid);
      if (tokenResult) {
        if (tokenResult.dragPreview) {
          this.broadcastDragPreview(tokenResult.dragPreview, message.t);
        }
        this.handleRouteResult(tokenResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to CharacterDispatcher
      const characterResult = this.characterDispatcher.dispatch(message, context, senderUid);
      if (characterResult) {
        this.handleRouteResult(characterResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to PlayerDispatcher
      const playerResult = this.playerDispatcher.dispatch(message, context, senderUid);
      if (playerResult) {
        this.handleRouteResult(playerResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      const mapStudioResult = this.mapStudioMessageHandler.handle(
        message,
        senderUid,
        this.getRoomIdForUid(senderUid),
        context.isDM(),
      );
      if (mapStudioResult) {
        this.handleRouteResult(mapStudioResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      const sceneResult = this.sceneMessageHandler.handle(
        message,
        this.getRoomIdForUid(senderUid),
        context.isDM(),
      );
      if (sceneResult) {
        this.handleRouteResult(sceneResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to MapDispatcher
      const mapResult = this.mapDispatcher.dispatch(message, context, senderUid);
      if (mapResult) {
        this.handleRouteResult(mapResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to PropDispatcher
      const propResult = this.propDispatcher.dispatch(message, context, senderUid);
      if (propResult) {
        this.handleRouteResult(propResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to InitiativeDispatcher
      const initiativeResult = this.initiativeDispatcher.dispatch(message, context, senderUid);
      if (initiativeResult) {
        this.handleRouteResult(initiativeResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to SelectionDispatcher
      const selectionResult = this.selectionDispatcher.dispatch(message, context, senderUid);
      if (selectionResult) {
        this.handleRouteResult(selectionResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to DiceDispatcher
      const diceResult = this.diceDispatcher.dispatch(message, context, senderUid);
      if (diceResult) {
        this.handleRouteResult(diceResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      // Delegate to RoomDispatcher
      const roomResult = this.roomDispatcher.dispatch(message, context, senderUid);
      if (roomResult) {
        this.handleRouteResult(roomResult, message.t);
        this.acknowledgeSuccess(message, senderUid);
        return;
      }

      this.messageLogger.logUnknownMessageType((message as ClientMessage).t);
      this.acknowledgeSuccess(message, senderUid);
    } catch (err) {
      this.messageErrorHandler.handleError(err, message, senderUid);
      this.acknowledgeFailure(message, senderUid, err);
    }
  }

  private handleRouteResult(result: RouteHandlerResult | null | undefined, reason: string): void {
    if (!result) {
      return;
    }

    const shouldSkipBroadcastVersionBump = Boolean(result.delta && result.broadcast);

    if (result.delta) {
      this.emitDelta(result.delta, reason);
    }

    this.skipNextBroadcastVersionBump = shouldSkipBroadcastVersionBump;
    const pointerResult = result as PointerHandlerResult;
    const shouldSuppressBroadcast =
      reason === "point" || reason === "heartbeat" || Boolean(pointerResult.preview);
    const routeResult = { ...result, reason };
    const routeResultInput = shouldSuppressBroadcast
      ? { ...routeResult, broadcast: false }
      : routeResult;
    this.routeResultHandler.handleResult(routeResultInput);

    if (!result.broadcast) {
      this.skipNextBroadcastVersionBump = false;
    }
    if (pointerResult.preview) {
      this.broadcastPointerPreview(pointerResult.preview, reason);
    }
  }

  /**
   * Debounced broadcast - batches rapid state changes into a single broadcast
   * Waits 16ms (one frame at 60fps) before broadcasting to batch operations
   * Delegates to BroadcastService
   *
   * **Week 8 Note:**
   * This method is used as a callback by RouteResultHandler (line 116).
   * It cannot be removed despite appearing "private" because it's part of the
   * handler result pattern established in Week 4.
   */
  private emitDelta(delta: PendingDelta, reason: string): void {
    const stateVersion = this.roomService.bumpStateVersion();
    const message = this.buildDeltaMessage(delta, stateVersion);
    if (delta.t === "token-updated") {
      this.emitTokenDelta(message, delta, stateVersion);
    } else {
      this.sendToAuthorizedClients(message);
    }
    this.messageLogger.logMessageRouting(`${delta.t}-delta`, reason);
  }

  /**
   * Secrecy-aware token delta. Per recipient:
   * - DMs always get the raw delta.
   * - Hidden-NPC tokens never reach players — they get a state-sync so the
   *   version stream stays gapless (this applies with fog on OR off).
   * - The token's owner gets a fresh filtered snapshot when their own move
   *   relocated their vision origin (newly visible entities must arrive),
   *   otherwise the raw delta (e.g. a blocked-move correction).
   * - Others get the delta while the token stays inside their vision, a
   *   filtered snapshot when it crosses their vision boundary (a delta would
   *   leak the hidden destination or leave a stale ghost), and a state-sync
   *   when it stays hidden.
   */
  private emitTokenDelta(
    message: ServerMessage,
    delta: Extract<PendingDelta, { t: "token-updated" }>,
    stateVersion: number,
  ): void {
    const state = this.roomService.getState();
    const isHiddenNpc = getHiddenNpcTokenIds(state).has(delta.token.id);
    const fogActive = this.fogFilteringActive();
    if (!isHiddenNpc && !fogActive) {
      this.sendToAuthorizedClients(message);
      return;
    }

    const payload = JSON.stringify(message);
    const syncPayload = JSON.stringify({ t: "state-sync", stateVersion });
    const newWorld = gridCellToWorldPoint(state.gridSize, {
      x: delta.token.x,
      y: delta.token.y,
    });
    const previousWorld = delta.previousCell
      ? gridCellToWorldPoint(state.gridSize, delta.previousCell)
      : newWorld;
    const ownerMoved =
      !delta.previousCell ||
      delta.previousCell.x !== delta.token.x ||
      delta.previousCell.y !== delta.token.y;
    const wsToUid = this.buildWsToUid();

    this.getAuthorizedClients().forEach((client) => {
      if (client.readyState !== 1) return;
      const uid = wsToUid.get(client);
      if (!uid) return; // fail closed: unidentified sockets learn nothing
      if (this.isRecipientDM(uid)) {
        client.send(payload);
        return;
      }
      if (isHiddenNpc) {
        client.send(syncPayload);
        return;
      }
      if (uid === delta.token.owner) {
        if (fogActive && ownerMoved) {
          client.send(JSON.stringify(this.roomService.createSnapshotForPlayer(uid)));
        } else {
          client.send(payload);
        }
        return;
      }
      const context = this.getVisionContextFor(uid);
      if (!context) {
        client.send(payload);
        return;
      }
      const sawBefore = isWorldPointVisible(context, previousWorld);
      const seesNow = isWorldPointVisible(context, newWorld);
      if (sawBefore && seesNow) {
        client.send(payload);
      } else if (sawBefore !== seesNow) {
        client.send(JSON.stringify(this.roomService.createSnapshotForPlayer(uid)));
      } else {
        client.send(syncPayload);
      }
    });
  }

  private fogFilteringActive(): boolean {
    const state = this.roomService.getState();
    return Boolean(state.fogEnabled && state.compiledScene);
  }

  private buildWsToUid(): Map<WebSocket, string> {
    const wsToUid = new Map<WebSocket, string>();
    for (const [uid, ws] of this.uidToWs.entries()) {
      wsToUid.set(ws, uid);
    }
    return wsToUid;
  }

  private isRecipientDM(uid: string): boolean {
    return this.roomService.getState().players.find((p) => p.uid === uid)?.isDM ?? false;
  }

  private getVisionContextFor(uid: string): VisionContext | null {
    const state = this.roomService.getState();
    const signature = visionSignature(state, uid);
    const cached = this.visionCache.get(uid);
    if (cached && cached.signature === signature) {
      return cached.context;
    }
    const context = createVisionContext(state, uid);
    this.visionCache.set(uid, { signature, context });
    return context;
  }

  private buildDeltaMessage(delta: PendingDelta, stateVersion: number): ServerMessage {
    switch (delta.t) {
      case "token-updated":
        return { t: "token-updated", stateVersion, token: delta.token };
      default:
        throw new Error(`Unsupported delta type: ${delta.t}`);
    }
  }

  private sendToAuthorizedClients(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    const clients = this.getAuthorizedClients();
    clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(payload);
      }
    });
  }

  private broadcastPointerPreview(pointer: Pointer, reason: string): void {
    if (!pointer) {
      return;
    }
    // DM pings are narration — always visible to the whole table. Player
    // pings inside unseen rooms stay unseen; the pinger always gets their
    // own echo. Pointer coordinates are world pixels.
    if (!this.fogFilteringActive() || this.isRecipientDM(pointer.uid)) {
      this.sendToAuthorizedClients({ t: "pointer-preview", pointer });
    } else {
      this.sendToVisionFilteredClients(
        { t: "pointer-preview", pointer },
        { x: pointer.x, y: pointer.y },
        pointer.uid,
      );
    }
    this.messageLogger.logMessageRouting("pointer-preview", reason);
  }

  private broadcastDragPreview(preview: DragPreviewEvent, reason?: string): void {
    if (!preview || preview.objects.length === 0) {
      return;
    }
    const state = this.roomService.getState();
    const hiddenNpcIds = getHiddenNpcTokenIds(state);
    const involvesHiddenNpc = preview.objects.some((object) => hiddenNpcIds.has(object.tokenId));
    if (this.fogFilteringActive() || involvesHiddenNpc) {
      this.broadcastFilteredDragPreview(preview, hiddenNpcIds);
    } else {
      this.sendToAuthorizedClients({ t: "drag-preview", preview });
    }
    this.messageLogger.logMessageRouting("drag-preview", reason ?? "drag-preview");
  }

  /**
   * Per-recipient drag previews. DMs see everything; hidden-NPC tokens never
   * reach players even while the DM drags them. Otherwise a recipient
   * receives the dragger's own preview, previews of tokens they own, and
   * previews inside their vision. A token dragged behind a wall simply
   * vanishes from the preview; the committed move resolves it via the delta
   * channel.
   */
  private broadcastFilteredDragPreview(preview: DragPreviewEvent, hiddenNpcIds: Set<string>): void {
    const state = this.roomService.getState();
    const fogActive = this.fogFilteringActive();
    const tokenOwners = new Map(state.tokens.map((token) => [token.id, token.owner]));
    const fullPayload = JSON.stringify({ t: "drag-preview", preview });
    const wsToUid = this.buildWsToUid();

    this.getAuthorizedClients().forEach((client) => {
      if (client.readyState !== 1) return;
      const uid = wsToUid.get(client);
      if (!uid) return; // fail closed
      if (this.isRecipientDM(uid)) {
        client.send(fullPayload);
        return;
      }
      const context = fogActive ? this.getVisionContextFor(uid) : null;
      const objects = preview.objects.filter((object) => {
        if (hiddenNpcIds.has(object.tokenId)) return false;
        if (uid === preview.uid || tokenOwners.get(object.tokenId) === uid) return true;
        if (!fogActive || !context) return true;
        return isWorldPointVisible(
          context,
          gridCellToWorldPoint(state.gridSize, { x: object.x, y: object.y }),
        );
      });
      if (objects.length === 0) return;
      client.send(
        objects.length === preview.objects.length
          ? fullPayload
          : JSON.stringify({ t: "drag-preview", preview: { ...preview, objects } }),
      );
    });
  }

  /** Send to owners/DMs always, others only when the point is inside their vision. */
  private sendToVisionFilteredClients(
    message: ServerMessage,
    worldPoint: ScenePoint,
    ownerUid?: string,
  ): void {
    const payload = JSON.stringify(message);
    const wsToUid = this.buildWsToUid();
    this.getAuthorizedClients().forEach((client) => {
      if (client.readyState !== 1) return;
      const uid = wsToUid.get(client);
      if (!uid) return; // fail closed
      if (uid === ownerUid || this.isRecipientDM(uid)) {
        client.send(payload);
        return;
      }
      const context = this.getVisionContextFor(uid);
      if (!context || isWorldPointVisible(context, worldPoint)) {
        client.send(payload);
      }
    });
  }

  private broadcast(reason?: string): void {
    const skipVersionBump = this.skipNextBroadcastVersionBump;
    this.skipNextBroadcastVersionBump = false;
    this.broadcastService.broadcast(() => {
      this.roomService.broadcast(this.getAuthorizedClients(), this.uidToWs, {
        reason,
        skipVersionBump,
      });
    });
  }

  /**
   * Send a control message to a specific client
   * Delegates to DirectMessageService
   *
   * **Week 8 Note:**
   * This method is used as a callback by RoomMessageHandler (line 159).
   * It cannot be removed despite appearing unused in messageRouter because
   * it's passed to and invoked by external handlers.
   */
  private sendControlMessage(targetUid: string, message: ServerMessage): void {
    this.directMessageService.sendControlMessage(targetUid, message);
  }

  private sendMapStudioMessageToDMs(roomId: string, message: ServerMessage): void {
    const state = this.roomService.getState();
    state.players
      .filter((player) => player.isDM && this.getRoomIdForUid(player.uid) === roomId)
      .forEach((player) => this.sendControlMessage(player.uid, message));
  }

  private acknowledgeSuccess(message: ClientMessage, senderUid: string): void {
    if (!this.shouldAcknowledge(message)) {
      return;
    }
    this.sendControlMessage(senderUid, { t: "ack", commandId: message.commandId! });
  }

  private acknowledgeFailure(message: ClientMessage, senderUid: string, error: unknown): void {
    if (!this.shouldAcknowledge(message)) {
      return;
    }
    this.sendControlMessage(senderUid, {
      t: "nack",
      commandId: message.commandId!,
      reason: error instanceof Error ? error.message : undefined,
    });
  }

  private shouldAcknowledge(message: ClientMessage): boolean {
    if (!isCommandAckEnabled() || !message.commandId) {
      return false;
    }
    switch (message.t) {
      case "authenticate":
      case "heartbeat":
      case "rtc-signal":
        return false;
      default:
        return true;
    }
  }
}
