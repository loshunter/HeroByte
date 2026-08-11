import type { ClientMessage } from "@herobyte/shared";
import type { PropMessageHandler } from "../handlers/PropMessageHandler.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class PropDispatcher {
  constructor(
    private handler: PropMessageHandler,
    private authWrapper: AuthorizationCheckWrapper,
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): RouteHandlerResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    // The wrapper's second argument is "is this sender authorized", which for
    // props is no longer purely the role: the room's playerPropsEnabled toggle
    // admits players too, re-read from state on EVERY message so flipping it
    // off bites immediately, whatever the client's toolbar still shows.
    switch (message.t) {
      case "create-prop": {
        const authorized = isDM || state.playerPropsEnabled;
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, authorized, "create prop", () =>
            this.handler.handleCreateProp(
              state,
              message.label,
              message.imageUrl,
              // A non-DM's `owner` field is overwritten, not trusted: the wire
              // must not mint DM-only (null), shared ("*"), or someone-else's
              // props on a player's behalf.
              isDM ? message.owner : senderUid,
              message.size,
              message.viewport,
              state.gridSize,
              message.count,
            ),
          ) ?? {}
        );
      }

      case "update-prop": {
        const prop = state.props.find((candidate) => candidate.id === message.id);
        // Strict owner match on purpose: owner "*" means everyone may MOVE a
        // prop (TransformHandler's rule), not re-label or re-image it.
        const authorized =
          isDM || (state.playerPropsEnabled && prop !== undefined && prop.owner === senderUid);
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, authorized, "update prop", () =>
            this.handler.handleUpdateProp(state, message.id, {
              label: message.label,
              imageUrl: message.imageUrl,
              // A player edit can't re-home a prop; only a DM assigns owners.
              owner: isDM ? message.owner : (prop?.owner ?? senderUid),
              size: message.size,
            }),
          ) ?? {}
        );
      }

      case "delete-prop": {
        const prop = state.props.find((candidate) => candidate.id === message.id);
        const authorized =
          isDM || (state.playerPropsEnabled && prop !== undefined && prop.owner === senderUid);
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, authorized, "delete prop", () =>
            this.handler.handleDeleteProp(state, message.id),
          ) ?? {}
        );
      }

      default:
        return null;
    }
  }
}
