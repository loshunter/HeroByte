import type { ClientMessage } from "@shared";
import type { PlayerMessageHandler } from "../handlers/PlayerMessageHandler.js";
import type { MessageRoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class PlayerDispatcher {
  constructor(private handler: PlayerMessageHandler) {}

  dispatch(
    message: ClientMessage,
    context: MessageRoutingContext,
    senderUid: string
  ): RouteHandlerResult | null {
    const state = context.getState();

    switch (message.t) {
      case "portrait":
        return this.handler.handlePortrait(state, senderUid, message.data);

      case "rename":
        return this.handler.handleRename(state, senderUid, message.name);

      case "mic-level":
        return this.handler.handleMicLevel(state, senderUid, message.level);

      case "set-hp":
        return this.handler.handleSetHP(
          state,
          senderUid,
          message.hp,
          message.maxHp
        );

      case "set-status-effects":
        return this.handler.handleSetStatusEffects(
          state,
          senderUid,
          message.effects
        );

      case "toggle-dm":
        return this.handler.handleToggleDM(senderUid);

      default:
        return null;
    }
  }
}
