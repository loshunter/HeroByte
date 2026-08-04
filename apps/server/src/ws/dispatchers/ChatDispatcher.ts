import type { ClientMessage } from "@herobyte/shared";
import type { ChatMessageHandler } from "../handlers/ChatMessageHandler.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * `senderUid` is threaded straight through to the handler, because who sent a
 * message is not the sender's claim to make.
 *
 * This comment used to point at DiceDispatcher as the counter-example — it
 * named its third parameter `_senderUid` and threw it away, which was arc
 * defect D2. S5 fixed that, so dice now work the same way chat always has.
 */
export class ChatDispatcher {
  constructor(private handler: ChatMessageHandler) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();

    switch (message.t) {
      case "chat":
        return this.handler.handleChat(state, senderUid, message.text, message.to);

      case "clear-chat-log":
        return this.handler.handleClearChatLog(state, senderUid, context.isDM());

      default:
        return null;
    }
  }
}
