// ============================================================================
// WEBSOCKET MESSAGE ROUTER
// ============================================================================
// Routes incoming WebSocket messages to appropriate domain services

import type { WebSocket, WebSocketServer } from "ws";
import type { SignalData } from "simple-peer";
import type { ClientMessage, ServerMessage } from "@shared";
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
import { PointerHandler } from "./handlers/PointerHandler.js";
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

/**
 * Message router - handles all WebSocket messages and dispatches to domain services
 */
export class MessageRouter {
  private roomService: RoomService;
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
  private broadcastDebounceTimer: NodeJS.Timeout | null = null;

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
   * Check if a player has DM privileges
   */
  private isDM(senderUid: string): boolean {
    const state = this.roomService.getState();
    const player = state.players.find((p) => p.uid === senderUid);
    return player?.isDM ?? false;
  }

  /**
   * Route a message to the appropriate handler
   */
  route(message: ClientMessage, senderUid: string): void {
    console.log(`[MessageRouter] Routing message type: ${message.t} from ${senderUid}`);
    const state = this.roomService.getState();

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
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "recolor": {
          const result = this.tokenMessageHandler.handleRecolor(state, message.id, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "delete-token": {
          const result = this.tokenMessageHandler.handleDelete(
            state,
            message.id,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "update-token-image": {
          const result = this.tokenMessageHandler.handleUpdateImage(
            state,
            message.tokenId,
            senderUid,
            message.imageUrl,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "set-token-size": {
          const result = this.tokenMessageHandler.handleSetSize(
            state,
            message.tokenId,
            senderUid,
            message.size,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "set-token-color": {
          const result = this.tokenMessageHandler.handleSetColor(
            state,
            message.tokenId,
            senderUid,
            message.color,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        // PLAYER ACTIONS
        case "portrait": {
          const result = this.playerMessageHandler.handlePortrait(state, senderUid, message.data);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "rename": {
          const result = this.playerMessageHandler.handleRename(state, senderUid, message.name);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "mic-level": {
          const result = this.playerMessageHandler.handleMicLevel(state, senderUid, message.level);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "set-hp": {
          const result = this.playerMessageHandler.handleSetHP(
            state,
            senderUid,
            message.hp,
            message.maxHp,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "set-status-effects": {
          const result = this.playerMessageHandler.handleSetStatusEffects(
            state,
            senderUid,
            message.effects,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
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
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to create character`);
            break;
          }
          const result = this.characterMessageHandler.handleCreateCharacter(
            state,
            message.name,
            message.maxHp,
            message.portrait,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "create-npc": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to create NPC`);
            break;
          }
          const result = this.npcMessageHandler.handleCreateNPC(
            state,
            message.name,
            message.maxHp,
            message.portrait,
            { hp: message.hp, tokenImage: message.tokenImage },
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "update-npc": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to update NPC`);
            break;
          }
          const result = this.npcMessageHandler.handleUpdateNPC(state, message.id, {
            name: message.name,
            hp: message.hp,
            maxHp: message.maxHp,
            portrait: message.portrait,
            tokenImage: message.tokenImage,
          });
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "delete-npc": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to delete NPC`);
            break;
          }
          const result = this.npcMessageHandler.handleDeleteNPC(state, message.id);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "place-npc-token": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to place NPC token`);
            break;
          }
          const result = this.npcMessageHandler.handlePlaceNPCToken(state, message.id, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
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
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "start-combat": {
          const result = this.initiativeMessageHandler.handleStartCombat(
            state,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "end-combat": {
          const result = this.initiativeMessageHandler.handleEndCombat(
            state,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "next-turn": {
          const result = this.initiativeMessageHandler.handleNextTurn(
            state,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "previous-turn": {
          const result = this.initiativeMessageHandler.handlePreviousTurn(
            state,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "clear-all-initiative": {
          const result = this.initiativeMessageHandler.handleClearAllInitiative(
            state,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        // PROP ACTIONS
        case "create-prop": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to create prop`);
            break;
          }
          const result = this.propMessageHandler.handleCreateProp(
            state,
            message.label,
            message.imageUrl,
            message.owner,
            message.size,
            message.viewport,
            state.gridSize,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "update-prop": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to update prop`);
            break;
          }
          const result = this.propMessageHandler.handleUpdateProp(state, message.id, {
            label: message.label,
            imageUrl: message.imageUrl,
            owner: message.owner,
            size: message.size,
          });
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "delete-prop": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to delete prop`);
            break;
          }
          const result = this.propMessageHandler.handleDeleteProp(state, message.id);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "claim-character": {
          const result = this.characterMessageHandler.handleClaimCharacter(
            state,
            message.characterId,
            senderUid,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "add-player-character": {
          const result = this.characterMessageHandler.handleAddPlayerCharacter(
            state,
            senderUid,
            message.name,
            message.maxHp,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          console.log(`[MessageRouter] Broadcast and save complete`);
          break;
        }

        case "delete-player-character": {
          const result = this.characterMessageHandler.handleDeletePlayerCharacter(
            state,
            message.characterId,
            senderUid,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "update-character-name": {
          const result = this.characterMessageHandler.handleUpdateCharacterName(
            state,
            message.characterId,
            senderUid,
            message.name,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "update-character-hp": {
          const result = this.characterMessageHandler.handleUpdateCharacterHP(
            state,
            message.characterId,
            message.hp,
            message.maxHp,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "set-character-status-effects": {
          const result = this.characterMessageHandler.handleSetCharacterStatusEffects(
            state,
            message.characterId,
            senderUid,
            message.effects,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "link-token": {
          const result = this.tokenMessageHandler.handleLinkToken(
            state,
            message.characterId,
            message.tokenId,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        // MAP ACTIONS
        case "map-background": {
          const result = this.mapMessageHandler.handleMapBackground(state, message.data);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "grid-size": {
          const result = this.mapMessageHandler.handleGridSize(state, message.size);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "grid-square-size": {
          const result = this.mapMessageHandler.handleGridSquareSize(state, message.size);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "set-player-staging-zone": {
          const result = this.mapMessageHandler.handleSetPlayerStagingZone(
            state,
            senderUid,
            message.zone,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "point":
          if (this.pointerHandler.handlePointer(state, senderUid, message.x, message.y)) {
            this.broadcast();
          }
          break;

        case "draw": {
          const result = this.drawingMessageHandler.handleDraw(state, message.drawing, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "sync-player-drawings": {
          const result = this.drawingMessageHandler.handleSyncPlayerDrawings(
            state,
            senderUid,
            message.drawings,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "undo-drawing": {
          const result = this.drawingMessageHandler.handleUndoDrawing(state, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "redo-drawing": {
          const result = this.drawingMessageHandler.handleRedoDrawing(state, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "clear-drawings": {
          const result = this.drawingMessageHandler.handleClearDrawings(
            state,
            senderUid,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "select-drawing": {
          const result = this.drawingMessageHandler.handleSelectDrawing(
            state,
            message.id,
            senderUid,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "deselect-drawing": {
          const result = this.drawingMessageHandler.handleDeselectDrawing(state, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "select-object": {
          const result = this.selectionMessageHandler.handleSelectObject(
            state,
            senderUid,
            message.uid,
            message.objectId,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "deselect-object": {
          const result = this.selectionMessageHandler.handleDeselectObject(
            state,
            senderUid,
            message.uid,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
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
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "lock-selected": {
          const result = this.selectionMessageHandler.handleLockSelected(
            state,
            senderUid,
            message.uid,
            message.objectIds,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "unlock-selected": {
          const result = this.selectionMessageHandler.handleUnlockSelected(
            state,
            senderUid,
            message.uid,
            message.objectIds,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
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
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "delete-drawing": {
          const result = this.drawingMessageHandler.handleDeleteDrawing(state, message.id);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "erase-partial": {
          const result = this.drawingMessageHandler.handleErasePartial(
            state,
            message.deleteId,
            message.segments,
            senderUid,
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        // DICE ACTIONS
        case "dice-roll": {
          const result = this.diceMessageHandler.handleDiceRoll(state, message.roll);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "clear-roll-history": {
          const result = this.diceMessageHandler.handleClearRollHistory(state);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        // ROOM MANAGEMENT
        case "set-room-password": {
          this.roomMessageHandler.handleSetRoomPassword(state, senderUid, message.secret);
          break;
        }

        case "clear-all-tokens": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to clear all tokens`);
            break;
          }
          const result = this.tokenMessageHandler.handleClearAll(state, senderUid);
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
          break;
        }

        case "heartbeat": {
          if (this.heartbeatHandler.handleHeartbeat(state, senderUid)) {
            this.broadcast();
          }
          break;
        }

        case "load-session": {
          const result = this.roomMessageHandler.handleLoadSession(
            state,
            senderUid,
            message.snapshot,
            this.isDM(senderUid),
          );
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
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
          if (result.broadcast) this.broadcast();
          if (result.save) this.roomService.saveState();
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
          console.warn("Unknown message type:", (message as ClientMessage).t);
        }
      }
    } catch (err) {
      console.error(
        `[MessageRouter] Error routing message type=${message.t} from=${senderUid}:`,
        err,
      );
      console.error(`[MessageRouter] Message details:`, JSON.stringify(message));
    }
  }

  /**
   * Broadcast room state to all clients (immediate, no debouncing)
   */
  private broadcastImmediate(): void {
    this.roomService.broadcast(this.getAuthorizedClients());
  }

  /**
   * Debounced broadcast - batches rapid state changes into a single broadcast
   * Waits 16ms (one frame at 60fps) before broadcasting to batch operations
   */
  private broadcast(): void {
    if (this.broadcastDebounceTimer) {
      clearTimeout(this.broadcastDebounceTimer);
    }
    this.broadcastDebounceTimer = setTimeout(() => {
      this.broadcastDebounceTimer = null;
      this.broadcastImmediate();
    }, 16);
  }

  private sendControlMessage(targetUid: string, message: ServerMessage): void {
    const ws = this.uidToWs.get(targetUid);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}
