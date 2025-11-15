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
import { getRoomSecret } from "../config/auth.js";
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

        case "draw":
          this.mapService.addDrawing(state, message.drawing, senderUid);
          this.broadcast();
          break;

        case "sync-player-drawings": {
          const removedIds = state.drawings
            .filter((drawing) => drawing.owner === senderUid)
            .map((drawing) => drawing.id);
          this.mapService.replacePlayerDrawings(state, senderUid, message.drawings);
          for (const id of removedIds) {
            this.selectionService.removeObject(state, id);
          }
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "undo-drawing":
          if (this.mapService.undoDrawing(state, senderUid)) {
            this.broadcast();
          }
          break;

        case "redo-drawing":
          if (this.mapService.redoDrawing(state, senderUid)) {
            this.broadcast();
          }
          break;

        case "clear-drawings":
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to clear all drawings`);
            break;
          }
          for (const drawing of state.drawings) {
            this.selectionService.removeObject(state, drawing.id);
          }
          this.mapService.clearDrawings(state);
          this.broadcast();
          break;

        case "select-drawing":
          if (this.mapService.selectDrawing(state, message.id, senderUid)) {
            this.broadcast();
          }
          break;

        case "deselect-drawing":
          this.mapService.deselectDrawing(state, senderUid);
          this.broadcast();
          break;

        case "select-object": {
          if (message.uid !== senderUid) {
            console.warn(`select-object spoofed uid from ${senderUid}`);
            break;
          }
          console.info(`[DEBUG] select-object from ${senderUid}: objectId=${message.objectId}`);
          if (this.selectionService.selectObject(state, senderUid, message.objectId)) {
            this.broadcast();
          }
          break;
        }

        case "deselect-object": {
          if (message.uid !== senderUid) {
            console.warn(`deselect-object spoofed uid from ${senderUid}`);
            break;
          }
          console.info(`[DEBUG] deselect-object from ${senderUid}`);
          if (this.selectionService.deselect(state, senderUid)) {
            this.broadcast();
          }
          break;
        }

        case "select-multiple": {
          if (message.uid !== senderUid) {
            console.warn(`select-multiple spoofed uid from ${senderUid}`);
            break;
          }
          console.info(
            `[DEBUG] select-multiple from ${senderUid}: objectIds=${JSON.stringify(message.objectIds)}, mode=${message.mode ?? "replace"}`,
          );
          if (
            this.selectionService.selectMultiple(
              state,
              senderUid,
              message.objectIds,
              message.mode ?? "replace",
            )
          ) {
            this.broadcast();
          }
          break;
        }

        case "lock-selected": {
          if (message.uid !== senderUid) {
            console.warn(`lock-selected spoofed uid from ${senderUid}`);
            break;
          }
          const lockCount = this.roomService.lockSelectedObjects(senderUid, message.objectIds);
          if (lockCount > 0) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "unlock-selected": {
          if (message.uid !== senderUid) {
            console.warn(`unlock-selected spoofed uid from ${senderUid}`);
            break;
          }
          const unlockCount = this.roomService.unlockSelectedObjects(senderUid, message.objectIds);
          if (unlockCount > 0) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "move-drawing":
          if (this.mapService.moveDrawing(state, message.id, message.dx, message.dy, senderUid)) {
            this.broadcast();
          }
          break;

        case "delete-drawing":
          if (this.mapService.deleteDrawing(state, message.id)) {
            this.selectionService.removeObject(state, message.id);
            this.broadcast();
          }
          break;

        case "erase-partial":
          if (
            this.mapService.handlePartialErase(state, message.deleteId, message.segments, senderUid)
          ) {
            this.selectionService.removeObject(state, message.deleteId);
            this.broadcast();
          }
          break;

        // DICE ACTIONS
        case "dice-roll":
          this.diceService.addRoll(state, message.roll);
          this.broadcast();
          break;

        case "clear-roll-history":
          this.diceService.clearHistory(state);
          this.broadcast();
          break;

        // ROOM MANAGEMENT
        case "set-room-password": {
          const sender = state.players.find((p) => p.uid === senderUid);
          const isDM = sender?.isDM ?? false;

          if (!isDM) {
            this.sendControlMessage(senderUid, {
              t: "room-password-update-failed",
              reason: "Only Dungeon Masters can update the room password.",
            });
            break;
          }

          const nextSecret = message.secret?.trim() ?? "";
          const defaultSecret = getRoomSecret();
          const isDefaultPassword = nextSecret === defaultSecret;

          // Allow default password to bypass length validation
          if (!isDefaultPassword && (nextSecret.length < 6 || nextSecret.length > 128)) {
            this.sendControlMessage(senderUid, {
              t: "room-password-update-failed",
              reason: "Password must be between 6 and 128 characters.",
            });
            break;
          }

          try {
            const summary = this.authService.update(nextSecret);
            this.sendControlMessage(senderUid, {
              t: "room-password-updated",
              updatedAt: summary.updatedAt,
              source: summary.source,
            });
            console.log(`DM ${senderUid} updated the room password.`);
          } catch (error) {
            console.error("Failed to update room password:", error);
            this.sendControlMessage(senderUid, {
              t: "room-password-update-failed",
              reason: "Unable to update password. Check server logs.",
            });
          }
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
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to load session`);
            break;
          }
          this.roomService.loadSnapshot(message.snapshot);
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "transform-object": {
          if (
            this.roomService.applySceneObjectTransform(message.id, senderUid, {
              position: message.position,
              scale: message.scale,
              rotation: message.rotation,
              locked: message.locked,
            })
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "rtc-signal": {
          this.rtcSignalHandler.forwardSignal(message.target, senderUid, message.signal as SignalData);
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
