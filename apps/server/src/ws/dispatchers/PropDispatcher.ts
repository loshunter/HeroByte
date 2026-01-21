import type { ClientMessage } from "@shared";
import type { PropMessageHandler } from "../handlers/PropMessageHandler.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { MessageRoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class PropDispatcher {
  constructor(
    private handler: PropMessageHandler,
    private authWrapper: AuthorizationCheckWrapper,
  ) {}

  dispatch(
    message: ClientMessage,
    context: MessageRoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      case "create-prop":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "create prop", () =>
            this.handler.handleCreateProp(
              state,
              message.label,
              message.imageUrl,
              message.owner,
              message.size,
              message.viewport,
              state.gridSize,
            ),
          ) || null
        );

      case "update-prop":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "update prop", () =>
            this.handler.handleUpdateProp(state, message.id, {
              label: message.label,
              imageUrl: message.imageUrl,
              owner: message.owner,
              size: message.size,
            }),
          ) || null
        );

      case "delete-prop":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "delete prop", () =>
            this.handler.handleDeleteProp(state, message.id),
          ) || null
        );

      default:
        return null;
    }
  }
}
