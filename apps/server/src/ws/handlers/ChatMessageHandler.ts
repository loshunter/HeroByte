// ============================================================================
// CHAT MESSAGE HANDLER
// ============================================================================
// The one place a chat message's author is decided — and it is decided from
// `senderUid`, which the WebSocket layer derived from the connection, not
// from anything in the payload. `{ t: "chat" }` has no author field to trust
// in the first place (see the shared contract), so there is nothing here to
// get wrong by accident.

import type { RoomState } from "../../domains/room/model.js";
import type { ChatService } from "../../domains/chat/service.js";
import type { PlayerService } from "../../domains/player/service.js";
import type { RouteHandlerResult } from "../services/RouteResultHandler.js";

export class ChatMessageHandler {
  constructor(
    private chatService: ChatService,
    private playerService: PlayerService,
  ) {}

  /**
   * Record one message from `senderUid`.
   *
   * The display name is read from the sender's own player record rather than
   * taken from the wire, so a client cannot post under someone else's name
   * any more than it can post under their uid.
   */
  handleChat(
    state: RoomState,
    senderUid: string,
    text: string,
    to?: string,
  ): RouteHandlerResult | null {
    const author = this.playerService.findPlayer(state, senderUid);
    if (!author) {
      // Authenticated but with no player record — nothing legitimate produces
      // this, so drop it rather than inventing an identity for the message.
      console.warn(`[Chat] Dropping message from ${senderUid}: no player record`);
      return { broadcast: false, save: false };
    }

    this.chatService.addMessage(state, senderUid, author.name, text, to);
    return { broadcast: true, save: true };
  }

  /**
   * Wipe the log. DM-only: chat is shared history, and one player should not
   * be able to erase what the table said.
   */
  handleClearChatLog(state: RoomState, senderUid: string, isDM: boolean): RouteHandlerResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to clear the chat log`);
      return { broadcast: false, save: false };
    }
    this.chatService.clearHistory(state);
    return { broadcast: true, save: true };
  }
}
