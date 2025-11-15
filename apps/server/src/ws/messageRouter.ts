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
          // DEPRECATED: This action is replaced by elevate-to-dm flow
          // Kept for backwards compatibility but should not be used
          console.warn(`toggle-dm message from ${senderUid} ignored - use elevate-to-dm instead`);
          break;

        // CHARACTER ACTIONS
        case "create-character":
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to create character`);
            break;
          }
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
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to create NPC`);
            break;
          }
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
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to update NPC`);
            break;
          }
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
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to delete NPC`);
            break;
          }
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
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to place NPC token`);
            break;
          }
          if (
            this.characterService.placeNPCToken(state, this.tokenService, message.id, senderUid)
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        // INITIATIVE/COMBAT ACTIONS
        case "set-initiative": {
          // Check if sender owns the character or is DM
          const character = this.characterService.findCharacter(state, message.characterId);
          if (!character) {
            console.warn(`Character ${message.characterId} not found`);
            break;
          }
          const canModify =
            this.isDM(senderUid) || this.characterService.canControlCharacter(character, senderUid);
          if (!canModify) {
            console.warn(
              `Player ${senderUid} attempted to set initiative for character they don't own`,
            );
            break;
          }
          console.log(
            `[Server] Setting initiative for ${character.name} (${message.characterId}): initiative=${message.initiative}, modifier=${message.initiativeModifier}`,
          );
          if (
            this.characterService.setInitiative(
              state,
              message.characterId,
              message.initiative,
              message.initiativeModifier,
            )
          ) {
            console.log(`[Server] Broadcasting updated initiative for ${character.name}`);
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "start-combat": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to start combat`);
            break;
          }
          state.combatActive = true;
          // Set first character with initiative as current turn
          const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
          if (charactersInOrder.length > 0) {
            state.currentTurnCharacterId = charactersInOrder[0].id;
          }
          console.log(`Combat started by ${senderUid}`);
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "end-combat": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to end combat`);
            break;
          }
          state.combatActive = false;
          state.currentTurnCharacterId = undefined;
          this.characterService.clearAllInitiative(state);
          console.log(`Combat ended by ${senderUid}`);
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "next-turn": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to advance turn`);
            break;
          }
          const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
          if (charactersInOrder.length === 0) break;

          const currentIndex = charactersInOrder.findIndex(
            (c) => c.id === state.currentTurnCharacterId,
          );
          const nextIndex = (currentIndex + 1) % charactersInOrder.length;
          state.currentTurnCharacterId = charactersInOrder[nextIndex].id;
          console.log(`Turn advanced to ${charactersInOrder[nextIndex].name}`);
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "previous-turn": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to go back turn`);
            break;
          }
          const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
          if (charactersInOrder.length === 0) break;

          const currentIndex = charactersInOrder.findIndex(
            (c) => c.id === state.currentTurnCharacterId,
          );
          const prevIndex = currentIndex <= 0 ? charactersInOrder.length - 1 : currentIndex - 1;
          state.currentTurnCharacterId = charactersInOrder[prevIndex].id;
          console.log(`Turn moved back to ${charactersInOrder[prevIndex].name}`);
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "clear-all-initiative": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to clear all initiative`);
            break;
          }
          this.characterService.clearAllInitiative(state);
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        // PROP ACTIONS
        case "create-prop": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to create prop`);
            break;
          }
          this.propService.createProp(
            state,
            message.label,
            message.imageUrl,
            message.owner,
            message.size,
            message.viewport,
            state.gridSize,
          );
          this.broadcast();
          this.roomService.saveState();
          break;
        }

        case "update-prop":
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to update prop`);
            break;
          }
          if (
            this.propService.updateProp(state, message.id, {
              label: message.label,
              imageUrl: message.imageUrl,
              owner: message.owner,
              size: message.size,
            })
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "delete-prop": {
          if (!this.isDM(senderUid)) {
            console.warn(`Non-DM ${senderUid} attempted to delete prop`);
            break;
          }
          const removed = this.propService.deleteProp(state, message.id);
          if (removed) {
            // Remove from selection state
            this.selectionService.removeObject(state, `prop:${message.id}`);
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "claim-character":
          if (this.characterService.claimCharacter(state, message.characterId, senderUid)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "add-player-character": {
          console.log(
            `[MessageRouter] Received add-player-character from ${senderUid}:`,
            message.name,
          );
          // Create character for the requesting player
          const maxHp = message.maxHp ?? 100;
          const character = this.characterService.createCharacter(
            state,
            message.name,
            maxHp,
            undefined, // portrait - player can set later
            "pc",
          );

          // Auto-claim for the requesting player
          this.characterService.claimCharacter(state, character.id, senderUid);

          // Create and link token at spawn position
          const spawn = this.roomService.getPlayerSpawnPosition();
          const token = this.tokenService.createToken(state, senderUid, spawn.x, spawn.y);
          this.characterService.linkToken(state, character.id, token.id);

          console.log(
            `[MessageRouter] Player ${senderUid} created additional character: ${character.name} (ID: ${character.id})`,
          );
          console.log(
            `[MessageRouter] Broadcasting update. Total characters: ${state.characters.length}`,
          );
          this.broadcast();
          this.roomService.saveState();
          console.log(`[MessageRouter] Broadcast and save complete`);
          break;
        }

        case "delete-player-character": {
          // Find the character to delete
          const characterToDelete = this.characterService.findCharacter(state, message.characterId);

          // Permission check: Only allow if player owns this character
          if (!characterToDelete || characterToDelete.ownedByPlayerUID !== senderUid) {
            console.warn(`Player ${senderUid} tried to delete character they don't own`);
            break;
          }

          // Delete the character
          const deleted = this.characterService.deleteCharacter(state, message.characterId);
          if (deleted) {
            // Delete linked token if exists
            if (deleted.tokenId) {
              this.tokenService.forceDeleteToken(state, deleted.tokenId);
              this.selectionService.removeObject(state, deleted.tokenId);
            }
            console.log(`Player ${senderUid} deleted character: ${deleted.name}`);
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "update-character-name": {
          // Find the character to rename
          const characterToRename = this.characterService.findCharacter(state, message.characterId);

          // Permission check: Only allow if player owns this character
          if (!characterToRename || characterToRename.ownedByPlayerUID !== senderUid) {
            console.warn(`Player ${senderUid} tried to rename character they don't own`);
            break;
          }

          // Update the character name
          if (this.characterService.updateName(state, message.characterId, message.name)) {
            console.log(
              `Player ${senderUid} renamed character to: ${message.name} (ID: ${message.characterId})`,
            );
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

        case "update-character-hp":
          if (
            this.characterService.updateHP(state, message.characterId, message.hp, message.maxHp)
          ) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;

        case "set-character-status-effects": {
          // Find the character
          const character = this.characterService.findCharacter(state, message.characterId);

          // Permission check: Only allow if player owns this character or is DM
          const canModify =
            this.isDM(senderUid) ||
            (character && this.characterService.canControlCharacter(character, senderUid));

          if (!canModify) {
            console.warn(
              `Player ${senderUid} attempted to set status effects for character they don't control`,
            );
            break;
          }

          if (this.characterService.setStatusEffects(state, message.characterId, message.effects)) {
            this.broadcast();
            this.roomService.saveState();
          }
          break;
        }

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
          console.log("[DEBUG] Received set-player-staging-zone message:", {
            senderUid,
            zone: message.zone,
            timestamp: new Date().toISOString(),
          });
          const sender = state.players.find((player) => player.uid === senderUid);
          console.log("[DEBUG] Sender found:", {
            uid: sender?.uid,
            isDM: sender?.isDM,
            name: sender?.name,
          });
          if (!sender?.isDM) {
            console.log("[DEBUG] Rejected: sender is not DM");
            break;
          }
          const result = this.roomService.setPlayerStagingZone(message.zone);
          console.log("[DEBUG] setPlayerStagingZone result:", result);
          if (result) {
            this.broadcast();
            this.roomService.saveState();
            console.log("[DEBUG] Staging zone set successfully and saved");
          }
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
