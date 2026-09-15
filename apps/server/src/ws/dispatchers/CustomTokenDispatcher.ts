import type { ClientMessage } from "@herobyte/shared";
import type { CustomTokenMessageHandler } from "../handlers/CustomTokenMessageHandler.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

/**
 * A table's own Library tokens are the DM's shelf: no player toggle admits a
 * player here (unlike props), so the authorization is the role, full stop.
 */
export class CustomTokenDispatcher {
  constructor(
    private handler: CustomTokenMessageHandler,
    private authWrapper: AuthorizationCheckWrapper,
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      case "add-custom-token":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "add custom token", () =>
            this.handler.handleAdd(
              state,
              {
                name: message.name,
                imageUrl: message.imageUrl,
                description: message.description,
                tags: message.tags,
                size: message.size,
              },
              senderUid,
            ),
          ) ?? {}
        );

      case "remove-custom-token":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "remove custom token", () =>
            this.handler.handleRemove(state, message.id),
          ) ?? {}
        );

      default:
        return null;
    }
  }
}
