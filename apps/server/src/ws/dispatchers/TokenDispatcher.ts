import type { ClientMessage, DragPreviewEvent } from "@herobyte/shared";
import { isDragPreviewEnabled } from "../../config/featureFlags.js";
import type { TokenMessageHandler } from "../handlers/TokenMessageHandler.js";
import { ColorWriteBudget } from "../../domains/token/colorPolicy.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export interface TokenDispatcherResult extends RouteHandlerResult {
  dragPreview?: DragPreviewEvent;
}

/**
 * An over-budget colour write: nothing changes. Only a token the sender may colour
 * (its owner, or the DM) is answered, with the colour it keeps; any other id gets
 * the same silence as a refused write, so the throttle never says whether a token
 * exists or what colour a hidden or fogged one is.
 */
function throttled(
  state: { tokens: { id: string; owner: string; color: string }[] },
  tokenId: string,
  senderUid: string,
  isDM: boolean,
): TokenDispatcherResult {
  const token = state.tokens.find((candidate) => candidate.id === tokenId);
  if (!token || (token.owner !== senderUid && !isDM)) return { broadcast: false, save: false };
  return { colorNotice: { tokenId, color: token.color, throttled: true } };
}

export class TokenDispatcher {
  constructor(
    private handler: TokenMessageHandler,
    private authWrapper: AuthorizationCheckWrapper,
    // Colour writes cost cells x PCs each: a burst of 10, then 5 a second per player.
    private colorBudget: ColorWriteBudget = new ColorWriteBudget(),
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
  ): TokenDispatcherResult | null {
    const state = context.getState();
    const isDM = context.isDM();

    switch (message.t) {
      case "move":
        return this.handler.handleMove(state, message.id, senderUid, message.x, message.y, isDM);

      case "drag-preview": {
        if (!isDragPreviewEnabled()) {
          return {}; // Acknowledge but do nothing
        }
        const preview = this.handler.buildDragPreview(state, senderUid, message.objects, isDM);
        return preview ? { dragPreview: preview } : {};
      }

      case "recolor":
        if (!this.colorBudget.take(senderUid)) return throttled(state, message.id, senderUid, isDM);
        return this.handler.handleRecolor(state, message.id, senderUid, isDM);

      case "delete-token":
        return this.handler.handleDelete(state, message.id, senderUid, isDM);

      case "update-token-image":
        return this.handler.handleUpdateImage(
          state,
          message.tokenId,
          senderUid,
          message.imageUrl,
          isDM,
        );

      case "set-token-size":
        return this.handler.handleSetSize(state, message.tokenId, senderUid, message.size, isDM);

      case "set-token-color":
        if (!this.colorBudget.take(senderUid)) return throttled(state, message.tokenId, senderUid, isDM);
        return this.handler.handleSetColor(state, message.tokenId, senderUid, message.color, isDM);

      case "set-token-vision-radius":
        return this.handler.handleSetVisionRadius(state, message.tokenId, message.radius, isDM);

      case "link-token":
        return this.handler.handleLinkToken(
          state,
          message.characterId,
          message.tokenId,
          senderUid,
          isDM,
        );

      case "clear-all-tokens":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "clear all tokens", () =>
            this.handler.handleClearAll(state, senderUid),
          ) ?? {}
        );

      default:
        return null;
    }
  }
}
