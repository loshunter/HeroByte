import type { ClientMessage } from "@herobyte/shared";
import type { InitiativeMessageHandler } from "../handlers/InitiativeMessageHandler.js";
import type { InitiativeRollHandler } from "../handlers/InitiativeRollHandler.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class InitiativeDispatcher {
  constructor(
    private handler: InitiativeMessageHandler,
    private rollHandler: InitiativeRollHandler,
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
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
          isDM,
        );

      case "roll-initiative":
        return this.rollHandler.handleRollInitiative(
          state,
          message.characterId,
          senderUid,
          isDM,
          message.modifier,
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
