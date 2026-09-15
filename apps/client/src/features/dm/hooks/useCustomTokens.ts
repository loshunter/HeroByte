/**
 * useCustomTokens — the table's own Library tokens.
 *
 * Reads the shelf off the snapshot (DM-only on the wire, so a player's
 * snapshot simply has none) and sends the two messages that change it.
 * Fire-and-forget like usePropManagement: the shelf re-renders from the next
 * snapshot, and there is no in-flight state worth a spinner.
 */

import { useCallback } from "react";
import type { ClientMessage, CustomToken, RoomSnapshot } from "@herobyte/shared";
import type { CustomTokenDraft } from "../token-library/customTokensContext";

export interface UseCustomTokensOptions {
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
}

export interface UseCustomTokensResult {
  tokens: readonly CustomToken[];
  addToken: (draft: CustomTokenDraft) => void;
  removeToken: (id: string) => void;
}

/** One stable empty list, so consumers keyed on identity do not re-render per snapshot. */
const NONE: readonly CustomToken[] = Object.freeze([]);

export function useCustomTokens({
  snapshot,
  sendMessage,
}: UseCustomTokensOptions): UseCustomTokensResult {
  const tokens = snapshot?.customTokens ?? NONE;

  const addToken = useCallback(
    (draft: CustomTokenDraft) => {
      sendMessage({
        t: "add-custom-token",
        name: draft.name,
        imageUrl: draft.imageUrl,
        ...(draft.description ? { description: draft.description } : {}),
        tags: draft.tags,
        size: draft.size,
      });
    },
    [sendMessage],
  );

  const removeToken = useCallback(
    (id: string) => sendMessage({ t: "remove-custom-token", id }),
    [sendMessage],
  );

  return { tokens, addToken, removeToken };
}
