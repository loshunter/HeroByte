// ============================================================================
// CHAT DOMAIN - SERVICE
// ============================================================================
// Table talk: a bounded, per-room history of messages.
//
// The signature that matters is addMessage's: it takes `authorUid` and
// `authorName` as SEPARATE arguments from the text, and the only caller
// passes them from the connection. There is deliberately no overload that
// accepts a whole client-built ChatMessage — that shape is what MADE dice
// forgeable (arc defect D2, fixed in S5 by removing it), and refusing to
// offer it is what stops the same mistake being made here by accident.

import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import { ARRAY_LIMITS } from "../../middleware/validators/constants.js";

export class ChatService {
  private readonly MAX_MESSAGES = ARRAY_LIMITS.CHAT_HISTORY;

  /**
   * Append a message authored by `authorUid`.
   *
   * @param authorUid - Taken from the sending connection. Never from the payload.
   * @param authorName - Snapshotted now, so a later rename does not rewrite history.
   * @param text - Already length-validated; trimmed here so the stored copy is clean.
   * @param to - Whisper target uid, or undefined for the whole table.
   */
  addMessage(
    state: RoomState,
    authorUid: string,
    authorName: string,
    text: string,
    to?: string,
    timestamp: number = Date.now(),
  ): ChatMessage {
    const message: ChatMessage = {
      id: randomUUID(),
      authorUid,
      authorName,
      text: text.trim(),
      timestamp,
    };
    // Only set `to` when it is a real target: an explicit `to: undefined`
    // key would serialize as absent anyway, but a `to: ""` would read as a
    // whisper to nobody and be filtered away from everyone including its
    // author.
    if (to && to.trim().length > 0) {
      message.to = to.trim();
    }

    state.chatLog.push(message);
    if (state.chatLog.length > this.MAX_MESSAGES) {
      state.chatLog = state.chatLog.slice(-this.MAX_MESSAGES);
    }
    return message;
  }

  /** Wipe the room's history. */
  clearHistory(state: RoomState): void {
    state.chatLog = [];
  }

  /** Full unfiltered history — callers owe the per-recipient filter. */
  getHistory(state: RoomState): ChatMessage[] {
    return state.chatLog;
  }
}
