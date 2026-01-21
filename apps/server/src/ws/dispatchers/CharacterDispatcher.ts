import type { ClientMessage } from "@shared";
import type { CharacterMessageHandler } from "../handlers/CharacterMessageHandler.js";
import type { NPCMessageHandler } from "../handlers/NPCMessageHandler.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { MessageRoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class CharacterDispatcher {
  constructor(
    private characterHandler: CharacterMessageHandler,
    private npcHandler: NPCMessageHandler,
    private authWrapper: AuthorizationCheckWrapper
  ) {}

  dispatch(
    message: ClientMessage,
    context: MessageRoutingContext,
    senderUid: string
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      // Character Actions
      case "create-character":
        return this.authWrapper.executeIfDMAuthorized(
          senderUid,
          isDM,
          "create character",
          () =>
            this.characterHandler.handleCreateCharacter(
              state,
              message.name,
              message.maxHp,
              message.portrait
            )
        ) || null; // Return null if auth fails (result is undefined)

      case "claim-character":
        return this.characterHandler.handleClaimCharacter(
          state,
          message.characterId,
          senderUid
        );

      case "add-player-character":
        return this.characterHandler.handleAddPlayerCharacter(
          state,
          senderUid,
          message.name,
          message.maxHp
        );

      case "delete-player-character":
        return this.characterHandler.handleDeletePlayerCharacter(
          state,
          message.characterId,
          senderUid
        );

      case "update-character-name":
        return this.characterHandler.handleUpdateCharacterName(
          state,
          message.characterId,
          senderUid,
          message.name
        );

      case "update-character-hp":
        return this.characterHandler.handleUpdateCharacterHP(
          state,
          message.characterId,
          message.hp,
          message.maxHp
        );

      case "set-character-status-effects":
        return this.characterHandler.handleSetCharacterStatusEffects(
          state,
          message.characterId,
          senderUid,
          message.effects,
          isDM
        );

      case "set-character-portrait":
        return this.characterHandler.handleSetCharacterPortrait(
          state,
          message.characterId,
          senderUid,
          message.portrait,
          isDM
        );

      // NPC Actions
      case "create-npc":
        return this.authWrapper.executeIfDMAuthorized(
          senderUid,
          isDM,
          "create NPC",
          () =>
            this.npcHandler.handleCreateNPC(
              state,
              message.name,
              message.maxHp,
              message.portrait,
              { hp: message.hp, tokenImage: message.tokenImage }
            )
        ) || null;

      case "update-npc":
        return this.authWrapper.executeIfDMAuthorized(
          senderUid,
          isDM,
          "update NPC",
          () =>
            this.npcHandler.handleUpdateNPC(state, message.id, {
              name: message.name,
              hp: message.hp,
              maxHp: message.maxHp,
              portrait: message.portrait,
              tokenImage: message.tokenImage,
              initiativeModifier: message.initiativeModifier,
            })
        ) || null;

      case "delete-npc":
        return this.authWrapper.executeIfDMAuthorized(
          senderUid,
          isDM,
          "delete NPC",
          () => this.npcHandler.handleDeleteNPC(state, message.id)
        ) || null;

      case "place-npc-token":
        return this.authWrapper.executeIfDMAuthorized(
          senderUid,
          isDM,
          "place NPC token",
          () => this.npcHandler.handlePlaceNPCToken(state, message.id, senderUid)
        ) || null;

      case "toggle-npc-visibility":
        return this.authWrapper.executeIfDMAuthorized(
          senderUid,
          isDM,
          "toggle NPC visibility",
          () =>
            this.npcHandler.handleToggleNPCVisibility(
              state,
              message.id,
              message.visible
            )
        ) || null;

      default:
        return null;
    }
  }
}
