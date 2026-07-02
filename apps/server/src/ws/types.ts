import type { Token } from "@herobyte/shared";

/**
 * Pending delta payload emitted by message handlers before stateVersion
 * metadata is attached and broadcast to clients.
 *
 * `previousCell` carries the token's grid position before the change so
 * vision filtering can detect visibility transitions (a token crossing into
 * or out of a recipient's sight needs a full snapshot, not a delta).
 */
export type PendingDelta = {
  t: "token-updated";
  token: Token;
  previousCell?: { x: number; y: number };
};
