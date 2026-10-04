/**
 * ChatMessage: one line of table talk.
 *
 * `authorUid` and `authorName` are stamped by the SERVER from the sending
 * connection. Nothing a client sends can set them — the same rule DiceRoll
 * now follows. (Dice did not, until S5: a client-supplied playerUid was
 * stored verbatim, which was arc defect D2.)
 *
 * `authorName` is a snapshot of the name at send time rather than a join
 * against `players`, so renaming yourself does not rewrite your history.
 */
export interface ChatMessage {
  id: string; // Unique message identifier
  authorUid: string; // Who sent it — bound from the connection, never the client
  authorName: string; // Author's display name at send time
  text: string; // Message body (plain text; never rendered as HTML)
  /**
   * Whisper target's uid. Absent means the whole table.
   *
   * SECRECY: the server filters this per recipient in the snapshot, so a
   * whisper is never serialized to anyone but its author and its target.
   * Do not rely on the client to hide it.
   *
   * Bounded by the identity model: a live seat is protected by its session
   * token, but a fully offline UID can be claimed after that token's grace
   * expires. Its retained whispers then follow that seat. See visibleChatFor
   * for the complete boundary; this field is not an account identity.
   */
  to?: string;
  /** Target's server-roster name at send time; absent on legacy or unknown targets. */
  toName?: string;
  timestamp: number; // When the message was sent
}
