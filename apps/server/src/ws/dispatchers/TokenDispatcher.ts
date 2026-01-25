import type { ClientMessage, DragPreviewEvent } from "@shared";
import { isDragPreviewEnabled } from "../../config/featureFlags.js";
import type { TokenMessageHandler } from "../handlers/TokenMessageHandler.js";
import type { AuthorizationCheckWrapper } from "../services/AuthorizationCheckWrapper.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export interface TokenDispatcherResult extends RouteHandlerResult {
  dragPreview?: DragPreviewEvent;
}

export class TokenDispatcher {
  constructor(
    private handler: TokenMessageHandler,
    private authWrapper: AuthorizationCheckWrapper,
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
        return this.handler.handleSetSize(state, message.tokenId, senderUid, message.size);

      case "set-token-color":
        return this.handler.handleSetColor(state, message.tokenId, senderUid, message.color, isDM);

      case "link-token":
        return this.handler.handleLinkToken(state, message.characterId, message.tokenId);

      case "clear-all-tokens":
        return (
          this.authWrapper.executeIfDMAuthorized(senderUid, isDM, "clear all tokens", () =>
            this.handler.handleClearAll(state, senderUid),
          ) || null
        );

      default:
        return null;
    }
  }
}
