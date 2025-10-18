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
import { SelectionService } from "../domains/selection/service.js";
import { AuthService } from "../domains/auth/service.js";

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
  private selectionService: SelectionService;
  private authService: AuthService;
  private wss: WebSocketServer;
  private uidToWs: Map<string, WebSocket>;
  private getAuthorizedClients: () => Set<WebSocket>;

  constructor(
    roomService: RoomService,
    playerService: PlayerService,
    tokenService: TokenService,
    mapService: MapService,
    diceService: DiceService,
    characterService: CharacterService,
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
    this.selectionService = selectionService;
    this.authService = authService;
    this.wss = wss;
    this.uidToWs = uidToWs;
    this.getAuthorizedClients = getAuthorizedClients;
  }

  /**
   * Route a message to the appropriate handler
   */
  route(message: ClientMessage, senderUid: string): void {
    const state = this.roomService.getState();

    try {
      switch (message.t) {
        // TOKEN ACTIONS
        case "move":
          if (this.tokenService.moveToken(state, message.id, senderUid, message.x, message.y)) {
            this.broadcast();
          }
          break;

        case "recolor":
          if (this.tokenService.recolorToken(state, message.id, senderUid)) {
            this.broadcast();
          }
          break;

        case "delete-token": {
          // Check if sender is a DM - DMs can delete any token
          const sender = state.players.find((p) => p.uid === senderUid);
          const isDM = sender?.isDM ?? false;

          const success = isDM
            ? this.tokenService.forceDeleteToken(state, message.id)
            : this.tokenService.deleteToken(state, message.id, senderUid);

          if (success) {
            this.selectionService.removeObject(state, message.id);
            this.broadcast();
          }
          break;
        }

        case "update-token-image":
          if (this.tokenService.setImageUrl(state, message.tokenId, senderUid, message.imageUrl)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "set-token-size":
          if (this.tokenService.setTokenSize(state, message.tokenId, senderUid, message.size)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "set-token-color": {
          const sender = state.players.find((p) => p.uid === senderUid);
          const isDM = sender?.isDM ?? false;
          const updated = isDM
            ? this.tokenService.setColorForToken(state, message.tokenId, message.color)
            : this.tokenService.setColor(state, message.tokenId, senderUid, message.color);
          if (updated) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        // PLAYER ACTIONS
        case "portrait":
          if (this.playerService.setPortrait(state, senderUid, message.data)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "rename":
          if (this.playerService.rename(state, senderUid, message.name)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "mic-level":
          if (this.playerService.setMicLevel(state, senderUid, message.level)) {
            this.broadcast();
          }
          break;

        case "set-hp":
          if (this.playerService.setHP(state, senderUid, message.hp, message.maxHp)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "set-status-effects":
          if (this.playerService.setStatusEffects(state, senderUid, message.effects)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "toggle-dm":
          if (this.playerService.setDMMode(state, senderUid, message.isDM)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        // CHARACTER ACTIONS
        case "create-character":
          this.characterService.createCharacter(
            state,
            message.name,
            message.maxHp,
            message.portrait,
          );
          this.broadcast();
          this.roomService.saveState();
          break;

        case "create-npc":
          this.characterService.createCharacter(
            state,
            message.name,
            message.maxHp,
            message.portrait,
            "npc",
            { hp: message.hp, tokenImage: message.tokenImage },
          );
          this.broadcast();
          this.roomService.saveState();
          break;

        case "update-npc":
          if (
            this.characterService.updateNPC(state, this.tokenService, message.id, {
              name: message.name,
              hp: message.hp,
              maxHp: message.maxHp,
              portrait: message.portrait,
              tokenImage: message.tokenImage,
            })
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "delete-npc": {
          const removed = this.characterService.deleteCharacter(state, message.id);
          if (removed) {
            if (removed.tokenId) {
              this.tokenService.forceDeleteToken(state, removed.tokenId);
              this.selectionService.removeObject(state, removed.tokenId);
            }
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "place-npc-token":
          if (
            this.characterService.placeNPCToken(state, this.tokenService, message.id, senderUid)
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "claim-character":
          if (this.characterService.claimCharacter(state, message.characterId, senderUid)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "update-character-hp":
          if (
            this.characterService.updateHP(state, message.characterId, message.hp, message.maxHp)
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "link-token":
          if (this.characterService.linkToken(state, message.characterId, message.tokenId)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        // MAP ACTIONS
        case "map-background":
          this.mapService.setBackground(state, message.data);
          this.broadcast();
          break;

        case "grid-size":
          this.mapService.setGridSize(state, message.size);
          this.broadcast();
          break;

        case "grid-square-size":
          this.mapService.setGridSquareSize(state, message.size);
          this.broadcast();
          break;

        case "set-player-staging-zone": {
          const sender = state.players.find((player) => player.uid === senderUid);
          if (!sender?.isDM) {
            break;
          }
          if (this.roomService.setPlayerStagingZone(message.zone ?? null)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "point":
          this.mapService.placePointer(state, senderUid, message.x, message.y);
          this.broadcast();
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
          if (nextSecret.length < 6 || nextSecret.length > 128) {
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
          const removedIds = state.tokens
            .filter((token) => token.owner !== senderUid)
            .map((token) => token.id);
          this.tokenService.clearAllTokensExcept(state, senderUid);
          for (const tokenId of removedIds) {
            this.selectionService.removeObject(state, tokenId);
          }
          const removedPlayerUids = state.players
            .filter((player) => player.uid !== senderUid)
            .map((player) => player.uid);
          state.players = state.players.filter((p) => p.uid === senderUid);
          for (const uid of removedPlayerUids) {
            this.selectionService.deselect(state, uid);
          }
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "heartbeat": {
          const player = state.players.find((p) => p.uid === senderUid);
          if (player) {
            player.lastHeartbeat = Date.now();
          }
          // Broadcast to keep client connection alive (prevents heartbeat timeout)
          this.broadcast();
          break;
        }

        case "load-session": {
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
          this.forwardRtcSignal(message.target, senderUid, message.signal as SignalData);
          break;
        }

        default: {
          console.warn("Unknown message type:", (message as ClientMessage).t);
        }
      }
    } catch (err) {
      console.error("Error routing message:", err);
    }
  }

  /**
   * Forward WebRTC signaling to target peer
   */
  private forwardRtcSignal(targetUid: string, fromUid: string, signal: SignalData): void {
    const targetWs = this.uidToWs.get(targetUid);
    if (targetWs && targetWs.readyState === 1) {
      targetWs.send(JSON.stringify({ t: "rtc-signal", from: fromUid, signal }));
    }
  }

  /**
   * Broadcast room state to all clients
   */
  private broadcast(): void {
    this.roomService.broadcast(this.getAuthorizedClients());
  }

  private sendControlMessage(targetUid: string, message: ServerMessage): void {
    const ws = this.uidToWs.get(targetUid);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }
}
