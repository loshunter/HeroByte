import type { ClientMessage } from "@herobyte/shared";
import type { CharacterMessageHandler } from "../handlers/CharacterMessageHandler.js";
import type { NPCMessageHandler } from "../handlers/NPCMessageHandler.js";
import { handleResetMovementBudget } from "../handlers/movementBudgetMessages.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class CharacterDispatcher {
  constructor(
    private characterHandler: CharacterMessageHandler,
    private npcHandler: NPCMessageHandler,
    private authWrapper: AuthorizationCheckWrapper,
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      // Character Actions
      case "create-character":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "create character", () =>
            this.characterHandler.handleCreateCharacter(
              state,
              message.name,
              message.maxHp,
              message.portrait,
            ),
          ) ?? {}
        );

      case "claim-character":
        // PCs only. create-npc leaves a monster unowned and remove-player
        // un-claims one, so an unclaimed NPC is the DM's creature — and a
        // claim would hand a player delete-player-character over it.
        if (state.characters.find((c) => c.id === message.characterId)?.type !== "pc") {
          console.warn(`claim-character refused: ${message.characterId} is not a PC`);
          return { broadcast: false, save: false };
        }
        return this.characterHandler.handleClaimCharacter(state, message.characterId, senderUid);

      case "add-player-character":
        return this.characterHandler.handleAddPlayerCharacter(
          state,
          senderUid,
          message.name,
          message.maxHp,
        );

      case "delete-player-character":
        return this.characterHandler.handleDeletePlayerCharacter(
          state,
          message.characterId,
          senderUid,
          isDM,
        );

      case "update-character-name":
        return this.characterHandler.handleUpdateCharacterName(
          state,
          message.characterId,
          senderUid,
          message.name,
          isDM,
        );

      case "update-character-hp":
        return this.characterHandler.handleUpdateCharacterHP(
          state,
          message.characterId,
          message.hp,
          message.maxHp,
          senderUid,
          isDM,
          message.tempHp,
        );

      case "set-character-status-effects":
        return this.characterHandler.handleSetCharacterStatusEffects(
          state,
          message.characterId,
          senderUid,
          message.effects,
          isDM,
        );

      case "set-character-speed":
        return this.characterHandler.handleSetCharacterSpeed(
          state,
          message.characterId,
          senderUid,
          message.speed,
          isDM,
        );

      case "reset-movement-budget":
        return handleResetMovementBudget(state, message.characterId, senderUid, isDM);

      case "set-character-portrait":
        return this.characterHandler.handleSetCharacterPortrait(
          state,
          message.characterId,
          senderUid,
          message.portrait,
          isDM,
        );

      // NPC Actions
      case "create-npc":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "create NPC", () =>
            this.npcHandler.handleCreateNPC(state, message.name, message.maxHp, message.portrait, {
              hp: message.hp,
              tempHp: message.tempHp,
              tokenImage: message.tokenImage,
              tokenSize: message.tokenSize,
              disposition: message.disposition,
              count: message.count,
              visibleToPlayers: message.visibleToPlayers,
            }),
          ) ?? {}
        );

      case "update-npc":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "update NPC", () =>
            this.npcHandler.handleUpdateNPC(state, message.id, {
              name: message.name,
              hp: message.hp,
              maxHp: message.maxHp,
              tempHp: message.tempHp,
              portrait: message.portrait,
              tokenImage: message.tokenImage,
              initiativeModifier: message.initiativeModifier,
              disposition: message.disposition,
            }),
          ) ?? {}
        );

      case "delete-npc":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "delete NPC", () =>
            this.npcHandler.handleDeleteNPC(state, message.id),
          ) ?? {}
        );

      case "place-npc-token":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "place NPC token", () =>
            this.npcHandler.handlePlaceNPCToken(state, message.id, senderUid),
          ) ?? {}
        );

      case "toggle-npc-visibility":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "toggle NPC visibility", () =>
            this.npcHandler.handleToggleNPCVisibility(state, message.id, message.visible),
          ) ?? {}
        );

      default:
        return null;
    }
  }
}
