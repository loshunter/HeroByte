// ============================================================================
// WEBSOCKET MESSAGE ROUTER
// ============================================================================
// Routes incoming WebSocket messages to appropriate domain services

import type { WebSocket, WebSocketServer } from "ws";
import type { SignalData } from "simple-peer";
import type { ClientMessage, DragPreviewEvent, Pointer, ServerMessage } from "@shared";
import { isCommandAckEnabled, isDragPreviewEnabled } from "../config/featureFlags.js";
import { RoomService } from "../domains/room/service.js";
import { PlayerService } from "../domains/player/service.js";
import { TokenService } from "../domains/token/service.js";
import { MapService } from "../domains/map/service.js";
import { DiceService } from "../domains/dice/service.js";
import { CharacterService } from "../domains/character/service.js";
import { PropService } from "../domains/prop/service.js";
import { SelectionService } from "../domains/selection/service.js";
import { AuthService } from "../domains/auth/service.js";
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
import { AuthorizationService } from "./services/AuthorizationService.js";
import { MessageErrorHandler } from "./services/MessageErrorHandler.js";
import { BroadcastService } from "./services/BroadcastService.js";
import { DirectMessageService } from "./services/DirectMessageService.js";
import { RouteResultHandler, type RouteHandlerResult } from "./services/RouteResultHandler.js";
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
  private wss: WebSocketServer;
  private uidToWs: Map<string, WebSocket>;
  private getAuthorizedClients: () => Set<WebSocket>;
  private skipNextBroadcastVersionBump = false;

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
    this.rtcSignalHandler = new RTCSignalHandler(uidToWs);
    this.pointerHandler = new PointerHandler(mapService);
    this.tokenMessageHandler = new TokenMessageHandler(
      tokenService,
      characterService,
      selectionService,
      roomService,
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
    this.propMessageHandler = new PropMessageHandler(propService, selectionService);
    this.playerMessageHandler = new PlayerMessageHandler(playerService, roomService);
    this.initiativeMessageHandler = new InitiativeMessageHandler(characterService, roomService);
    this.mapMessageHandler = new MapMessageHandler(mapService, roomService);
    this.drawingMessageHandler = new DrawingMessageHandler(
      mapService,
      selectionService,
      roomService,
    );
    this.selectionMessageHandler = new SelectionMessageHandler(selectionService, roomService);
    this.diceMessageHandler = new DiceMessageHandler(diceService);
    this.roomMessageHandler = new RoomMessageHandler(
      roomService,
      authService,
      this.sendControlMessage.bind(this),
    );
    this.transformMessageHandler = new TransformMessageHandler(roomService);
  }

  /**
   * Route a message to the appropriate handler
   */
  route(message: ClientMessage, senderUid: string): void {
    this.messageLogger.logMessageRouting(message.t, senderUid);
    const context = this.messageRoutingContext.create(senderUid);
    const state = context.getState();

    try {
      switch (message.t) {
        // TOKEN ACTIONS
        case "move": {
          const result = this.tokenMessageHandler.handleMove(
            state,
            message.id,
            senderUid,
            message.x,
            message.y,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "drag-preview": {
          if (!isDragPreviewEnabled()) {
            break;
          }
          const preview = this.tokenMessageHandler.buildDragPreview(
            state,
            senderUid,
            message.objects,
            context.isDM(),
          );
          if (preview) {
            this.broadcastDragPreview(preview, message.t);
          }
          break;
        }

        case "recolor": {
          const result = this.tokenMessageHandler.handleRecolor(state, message.id, senderUid);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "delete-token": {
          const result = this.tokenMessageHandler.handleDelete(
            state,
            message.id,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "update-token-image": {
          const result = this.tokenMessageHandler.handleUpdateImage(
            state,
            message.tokenId,
            senderUid,
            message.imageUrl,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-token-size": {
          const result = this.tokenMessageHandler.handleSetSize(
            state,
            message.tokenId,
            senderUid,
            message.size,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-token-color": {
          const result = this.tokenMessageHandler.handleSetColor(
            state,
            message.tokenId,
            senderUid,
            message.color,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        // PLAYER ACTIONS
        case "portrait": {
          const result = this.playerMessageHandler.handlePortrait(state, senderUid, message.data);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "rename": {
          const result = this.playerMessageHandler.handleRename(state, senderUid, message.name);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "mic-level": {
          const result = this.playerMessageHandler.handleMicLevel(state, senderUid, message.level);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-hp": {
          const result = this.playerMessageHandler.handleSetHP(
            state,
            senderUid,
            message.hp,
            message.maxHp,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-status-effects": {
          const result = this.playerMessageHandler.handleSetStatusEffects(
            state,
            senderUid,
            message.effects,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "toggle-dm": {
          // DEPRECATED: This action is replaced by elevate-to-dm flow
          // Kept for backwards compatibility but should not be used
          this.playerMessageHandler.handleToggleDM(senderUid);
          break;
        }

        // CHARACTER ACTIONS
        case "create-character": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "create character",
            () =>
              this.characterMessageHandler.handleCreateCharacter(
                state,
                message.name,
                message.maxHp,
                message.portrait,
              ),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "create-npc": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "create NPC",
            () =>
              this.npcMessageHandler.handleCreateNPC(
                state,
                message.name,
                message.maxHp,
                message.portrait,
                { hp: message.hp, tokenImage: message.tokenImage },
              ),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "update-npc": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "update NPC",
            () =>
              this.npcMessageHandler.handleUpdateNPC(state, message.id, {
                name: message.name,
                hp: message.hp,
                maxHp: message.maxHp,
                portrait: message.portrait,
                tokenImage: message.tokenImage,
                initiativeModifier: message.initiativeModifier,
              }),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "delete-npc": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "delete NPC",
            () => this.npcMessageHandler.handleDeleteNPC(state, message.id),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "place-npc-token": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "place NPC token",
            () => this.npcMessageHandler.handlePlaceNPCToken(state, message.id, senderUid),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "toggle-npc-visibility": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "toggle NPC visibility",
            () =>
              this.npcMessageHandler.handleToggleNPCVisibility(state, message.id, message.visible),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        // INITIATIVE/COMBAT ACTIONS
        case "set-initiative": {
          const result = this.initiativeMessageHandler.handleSetInitiative(
            state,
            message.characterId,
            senderUid,
            message.initiative,
            message.initiativeModifier,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "start-combat": {
          const result = this.initiativeMessageHandler.handleStartCombat(
            state,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "end-combat": {
          const result = this.initiativeMessageHandler.handleEndCombat(
            state,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "next-turn": {
          const result = this.initiativeMessageHandler.handleNextTurn(
            state,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "previous-turn": {
          const result = this.initiativeMessageHandler.handlePreviousTurn(
            state,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "clear-all-initiative": {
          const result = this.initiativeMessageHandler.handleClearAllInitiative(
            state,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        // PROP ACTIONS
        case "create-prop": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "create prop",
            () =>
              this.propMessageHandler.handleCreateProp(
                state,
                message.label,
                message.imageUrl,
                message.owner,
                message.size,
                message.viewport,
                state.gridSize,
              ),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "update-prop": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "update prop",
            () =>
              this.propMessageHandler.handleUpdateProp(state, message.id, {
                label: message.label,
                imageUrl: message.imageUrl,
                owner: message.owner,
                size: message.size,
              }),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "delete-prop": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "delete prop",
            () => this.propMessageHandler.handleDeleteProp(state, message.id),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "claim-character": {
          const result = this.characterMessageHandler.handleClaimCharacter(
            state,
            message.characterId,
            senderUid,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "add-player-character": {
          const result = this.characterMessageHandler.handleAddPlayerCharacter(
            state,
            senderUid,
            message.name,
            message.maxHp,
          );
          this.handleRouteResult(result, message.t);
          this.messageLogger.logBroadcastComplete();
          break;
        }

        case "delete-player-character": {
          const result = this.characterMessageHandler.handleDeletePlayerCharacter(
            state,
            message.characterId,
            senderUid,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "update-character-name": {
          const result = this.characterMessageHandler.handleUpdateCharacterName(
            state,
            message.characterId,
            senderUid,
            message.name,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "update-character-hp": {
          const result = this.characterMessageHandler.handleUpdateCharacterHP(
            state,
            message.characterId,
            message.hp,
            message.maxHp,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-character-status-effects": {
          const result = this.characterMessageHandler.handleSetCharacterStatusEffects(
            state,
            message.characterId,
            senderUid,
            message.effects,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-character-portrait": {
          const result = this.characterMessageHandler.handleSetCharacterPortrait(
            state,
            message.characterId,
            senderUid,
            message.portrait,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "link-token": {
          const result = this.tokenMessageHandler.handleLinkToken(
            state,
            message.characterId,
            message.tokenId,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        // MAP ACTIONS
        case "map-background": {
          const result = this.mapMessageHandler.handleMapBackground(state, message.data);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "grid-size": {
          const result = this.mapMessageHandler.handleGridSize(state, message.size);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "grid-square-size": {
          const result = this.mapMessageHandler.handleGridSquareSize(state, message.size);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "set-player-staging-zone": {
          const result = this.mapMessageHandler.handleSetPlayerStagingZone(
            state,
            senderUid,
            message.zone,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "point": {
          const result = this.pointerHandler.handlePointer(state, senderUid, message.x, message.y);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "draw": {
          const result = this.drawingMessageHandler.handleDraw(state, message.drawing, senderUid);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "sync-player-drawings": {
          const result = this.drawingMessageHandler.handleSyncPlayerDrawings(
            state,
            senderUid,
            message.drawings,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "undo-drawing": {
          const result = this.drawingMessageHandler.handleUndoDrawing(state, senderUid);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "redo-drawing": {
          const result = this.drawingMessageHandler.handleRedoDrawing(state, senderUid);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "clear-drawings": {
          const result = this.drawingMessageHandler.handleClearDrawings(
            state,
            senderUid,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "select-drawing": {
          const result = this.drawingMessageHandler.handleSelectDrawing(
            state,
            message.id,
            senderUid,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "deselect-drawing": {
          const result = this.drawingMessageHandler.handleDeselectDrawing(state, senderUid);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "select-object": {
          const result = this.selectionMessageHandler.handleSelectObject(
            state,
            senderUid,
            message.uid,
            message.objectId,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "deselect-object": {
          const result = this.selectionMessageHandler.handleDeselectObject(
            state,
            senderUid,
            message.uid,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "select-multiple": {
          const result = this.selectionMessageHandler.handleSelectMultiple(
            state,
            senderUid,
            message.uid,
            message.objectIds,
            message.mode ?? "replace",
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "lock-selected": {
          const result = this.selectionMessageHandler.handleLockSelected(
            state,
            senderUid,
            message.uid,
            message.objectIds,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "unlock-selected": {
          const result = this.selectionMessageHandler.handleUnlockSelected(
            state,
            senderUid,
            message.uid,
            message.objectIds,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "move-drawing": {
          const result = this.drawingMessageHandler.handleMoveDrawing(
            state,
            message.id,
            message.dx,
            message.dy,
            senderUid,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "delete-drawing": {
          const result = this.drawingMessageHandler.handleDeleteDrawing(state, message.id);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "erase-partial": {
          const result = this.drawingMessageHandler.handleErasePartial(
            state,
            message.deleteId,
            message.segments,
            senderUid,
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        // DICE ACTIONS
        case "dice-roll": {
          const result = this.diceMessageHandler.handleDiceRoll(state, message.roll);
          this.handleRouteResult(result, message.t);
          break;
        }

        case "clear-roll-history": {
          const result = this.diceMessageHandler.handleClearRollHistory(state);
          this.handleRouteResult(result, message.t);
          break;
        }

        // ROOM MANAGEMENT
        case "set-room-password": {
          this.roomMessageHandler.handleSetRoomPassword(state, senderUid, message.secret);
          break;
        }

        case "clear-all-tokens": {
          const result = this.authorizationCheckWrapper.executeIfDMAuthorized(
            senderUid,
            context.isDM(),
            "clear all tokens",
            () => this.tokenMessageHandler.handleClearAll(state, senderUid),
          );
          if (result) {
            this.handleRouteResult(result, message.t);
          }
          break;
        }

        case "heartbeat": {
          const result = this.heartbeatHandler.handleHeartbeat(state, senderUid);
          this.handleRouteResult(result, message.t);
          this.sendControlMessage(senderUid, { t: "heartbeat-ack", timestamp: Date.now() });
          break;
        }

        case "request-room-resync": {
          const snapshot = this.roomService.createSnapshotForPlayer(senderUid);
          this.sendControlMessage(senderUid, snapshot);
          break;
        }

        case "load-session": {
          const result = this.roomMessageHandler.handleLoadSession(
            state,
            senderUid,
            message.snapshot,
            context.isDM(),
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "transform-object": {
          const result = this.transformMessageHandler.handleTransformObject(
            state,
            senderUid,
            message.id,
            {
              position: message.position,
              scale: message.scale,
              rotation: message.rotation,
              locked: message.locked,
            },
          );
          this.handleRouteResult(result, message.t);
          break;
        }

        case "rtc-signal": {
          this.rtcSignalHandler.forwardSignal(
            message.target,
            senderUid,
            message.signal as SignalData,
          );
          break;
        }

        default: {
          this.messageLogger.logUnknownMessageType((message as ClientMessage).t);
        }
      }
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
    this.routeResultHandler.handleResult({ ...result, reason });

    if (!result.broadcast) {
      this.skipNextBroadcastVersionBump = false;
    }

    const pointerResult = result as PointerHandlerResult;
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
    this.sendToAuthorizedClients(message);
    this.messageLogger.logMessageRouting(`${delta.t}-delta`, reason);
  }

  private buildDeltaMessage(delta: PendingDelta, stateVersion: number): ServerMessage {
    switch (delta.t) {
      case "token-updated":
        return { t: "token-updated", stateVersion, token: delta.token };
      default: {
        const exhaustiveCheck: never = delta;
        throw new Error(`Unsupported delta type: ${exhaustiveCheck}`);
      }
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
    this.sendToAuthorizedClients({ t: "pointer-preview", pointer });
    this.messageLogger.logMessageRouting("pointer-preview", reason);
  }

  private broadcastDragPreview(preview: DragPreviewEvent, reason?: string): void {
    if (!preview || preview.objects.length === 0) {
      return;
    }
    this.sendToAuthorizedClients({ t: "drag-preview", preview });
    this.messageLogger.logMessageRouting("drag-preview", reason);
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
