// ============================================================================
// WEBSOCKET MESSAGE ROUTER
// ============================================================================
// Routes incoming WebSocket messages to appropriate domain services

import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage } from "@shared";
import { RoomService } from "../domains/room/service.js";
import { PlayerService } from "../domains/player/service.js";
import { TokenService } from "../domains/token/service.js";
import { MapService } from "../domains/map/service.js";
import { DiceService } from "../domains/dice/service.js";

/**
 * Message router - handles all WebSocket messages and dispatches to domain services
 */
export class MessageRouter {
  private roomService: RoomService;
  private playerService: PlayerService;
  private tokenService: TokenService;
  private mapService: MapService;
  private diceService: DiceService;
  private wss: WebSocketServer;
  private uidToWs: Map<string, WebSocket>;

  constructor(
    roomService: RoomService,
    playerService: PlayerService,
    tokenService: TokenService,
    mapService: MapService,
    diceService: DiceService,
    wss: WebSocketServer,
    uidToWs: Map<string, WebSocket>
  ) {
    this.roomService = roomService;
    this.playerService = playerService;
    this.tokenService = tokenService;
    this.mapService = mapService;
    this.diceService = diceService;
    this.wss = wss;
    this.uidToWs = uidToWs;
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

        case "delete-token":
          if (this.tokenService.deleteToken(state, message.id, senderUid)) {
            this.broadcast();
          }
          break;

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

        // MAP ACTIONS
        case "map-background":
          this.mapService.setBackground(state, message.data);
          this.broadcast();
          break;

        case "grid-size":
          this.mapService.setGridSize(state, message.size);
          this.broadcast();
          break;

        case "point":
          this.mapService.placePointer(state, senderUid, message.x, message.y);
          this.broadcast();
          break;

        case "draw":
          this.mapService.addDrawing(state, message.drawing);
          this.broadcast();
          break;

        case "clear-drawings":
          this.mapService.clearDrawings(state);
          this.broadcast();
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
        case "clear-all-tokens":
          this.tokenService.clearAllTokensExcept(state, senderUid);
          // Also clear players except sender
          state.players = state.players.filter((p) => p.uid === senderUid);
          this.broadcast();
          this.roomService.saveState();
          break;

        // WEBRTC SIGNALING
        case "rtc-signal":
          this.forwardRtcSignal(message.target, senderUid, message.signal);
          break;

        default:
          console.warn("Unknown message type:", (message as any).t);
      }
    } catch (err) {
      console.error("Error routing message:", err);
    }
  }

  /**
   * Forward WebRTC signaling to target peer
   */
  private forwardRtcSignal(targetUid: string, fromUid: string, signal: any): void {
    const targetWs = this.uidToWs.get(targetUid);
    if (targetWs && targetWs.readyState === 1) {
      targetWs.send(JSON.stringify({ t: "rtc-signal", from: fromUid, signal }));
    }
  }

  /**
   * Broadcast room state to all clients
   */
  private broadcast(): void {
    this.roomService.broadcast(this.wss.clients);
  }
}
