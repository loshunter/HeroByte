import type { Token } from "@shared";

/**
 * Pending delta payload emitted by message handlers before stateVersion
 * metadata is attached and broadcast to clients.
 */
export type PendingDelta = { t: "token-updated"; token: Token };
