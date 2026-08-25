import type { ClientMessage } from "@herobyte/shared";
import type { DiceMessageHandler } from "../handlers/DiceMessageHandler.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * `senderUid` is threaded straight through to the handler, because who rolled
 * is not the roller's claim to make. This parameter used to be named
 * `_senderUid` and discarded — that discard was arc defect D2, and the message
 * it dispatched used to carry a finished roll with a client-chosen author and
 * total. It now carries only a formula.
 */
export class DiceDispatcher {
  constructor(private handler: DiceMessageHandler) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();

    switch (message.t) {
      case "dice-roll":
        return this.handler.handleDiceRoll(
          state,
          senderUid,
          message.formula,
          message.mode,
          message.visibility,
        );

      case "enter-roll":
        return this.handler.handleEnterRoll(
          state,
          senderUid,
          context.isDM(),
          message.total,
          message.rollId,
          message.formula,
          message.visibility,
        );

      case "clear-roll-history":
        return this.handler.handleClearRollHistory(state, senderUid, context.isDM());

      default:
        return null;
    }
  }
}
