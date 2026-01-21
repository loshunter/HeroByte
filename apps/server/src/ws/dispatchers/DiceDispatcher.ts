import type { ClientMessage } from "@shared";
import type { DiceMessageHandler } from "../handlers/DiceMessageHandler.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class DiceDispatcher {
  constructor(private handler: DiceMessageHandler) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    _senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();

    switch (message.t) {
      case "dice-roll":
        return this.handler.handleDiceRoll(state, message.roll);

      case "clear-roll-history":
        return this.handler.handleClearRollHistory(state);

      default:
        return null;
    }
  }
}
