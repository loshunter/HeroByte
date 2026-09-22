import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import type { PlayerMessageHandler } from "../handlers/PlayerMessageHandler.js";
import { removePlayer } from "../handlers/removePlayer.js";
import type { RemovePlayerDeps } from "../handlers/removePlayer.js";
import type { RoutingContext } from "../services/MessageRoutingContext.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class PlayerDispatcher {
  constructor(
    private handler: PlayerMessageHandler,
    private removePlayerDeps: RemovePlayerDeps,
    /** One recipient: the acting DM's own socket (DirectMessageService). */
    private sendToSender: (uid: string, message: ServerMessage) => void,
  ) {}

  dispatch(
    message: ClientMessage,
    context: RoutingContext,
    senderUid: string,
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
          message.maxHp,
          message.tempHp,
        );

      case "set-status-effects":
        return this.handler.handleSetStatusEffects(state, senderUid, message.effects);

      case "toggle-dm":
        return this.handler.handleToggleDM(senderUid);

      case "remove-player": {
        // DM-only (AuthorizationService lists it). The refusal is the
        // AuthorizationCheckWrapper's shape (no broadcast, no save) without the
        // wrapper, which this dispatcher has never carried — and silent, on
        // purpose: a player never sees this button, and a nack would be an
        // oracle for who is at the table.
        if (!context.isDM()) {
          console.warn(`Non-DM ${senderUid} attempted to remove player ${message.uid}`);
          return { broadcast: false, save: false };
        }
        const result = removePlayer(this.removePlayerDeps, state, message.uid, senderUid);
        if (result.refused) {
          // The DM clicked a button that did nothing: say why, to them alone.
          this.sendToSender(senderUid, {
            t: "remove-player-refused",
            uid: message.uid,
            reason: result.refused,
          });
        }
        return { broadcast: result.broadcast, save: result.save };
      }

      default:
        return null;
    }
  }
}
