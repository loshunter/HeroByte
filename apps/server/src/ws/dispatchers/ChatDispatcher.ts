import type { ClientMessage } from "@herobyte/shared";
import type { ChatMessageHandler } from "../handlers/ChatMessageHandler.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * Note the contrast with DiceDispatcher, which names its third parameter
 * `_senderUid` and throws it away — that discard is exactly why dice are
 * forgeable (arc defect D2). Chat threads it straight through to the handler,
 * because who sent a message is not the sender's claim to make.
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
