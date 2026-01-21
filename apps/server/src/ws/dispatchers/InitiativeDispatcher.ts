import type { ClientMessage } from "@shared";
import type { InitiativeMessageHandler } from "../handlers/InitiativeMessageHandler.js";
import type { MessageRoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class InitiativeDispatcher {
  constructor(private handler: InitiativeMessageHandler) {}

  dispatch(
    message: ClientMessage,
    context: MessageRoutingContext,
    senderUid: string
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      case "set-initiative":
        return this.handler.handleSetInitiative(
          state,
          message.characterId,
          senderUid,
          message.initiative,
          message.initiativeModifier,
          isDM
        );

      case "start-combat":
        return this.handler.handleStartCombat(state, senderUid, isDM);

      case "end-combat":
        return this.handler.handleEndCombat(state, senderUid, isDM);

      case "next-turn":
        return this.handler.handleNextTurn(state, senderUid, isDM);

      case "previous-turn":
        return this.handler.handlePreviousTurn(state, senderUid, isDM);

      case "clear-all-initiative":
        return this.handler.handleClearAllInitiative(state, senderUid, isDM);

      default:
        return null;
    }
  }
}
