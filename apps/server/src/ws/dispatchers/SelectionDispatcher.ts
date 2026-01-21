import type { ClientMessage } from "@shared";
import type { SelectionMessageHandler } from "../handlers/SelectionMessageHandler.js";
import type { MessageRoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class SelectionDispatcher {
  constructor(private handler: SelectionMessageHandler) {}

  dispatch(
    message: ClientMessage,
    context: MessageRoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();

    switch (message.t) {
      case "select-object":
        return (
          this.handler.handleSelectObject(state, senderUid, message.uid, message.objectId) || {}
        );

      case "deselect-object":
        return this.handler.handleDeselectObject(state, senderUid, message.uid) || {};

      case "select-multiple":
        return (
          this.handler.handleSelectMultiple(
            state,
            senderUid,
            message.uid,
            message.objectIds,
            message.mode ?? "replace",
          ) || {}
        );

      case "lock-selected":
        return (
          this.handler.handleLockSelected(state, senderUid, message.uid, message.objectIds) || {}
        );

      case "unlock-selected":
        return (
          this.handler.handleUnlockSelected(state, senderUid, message.uid, message.objectIds) || {}
        );

      default:
        return null;
    }
  }
}
