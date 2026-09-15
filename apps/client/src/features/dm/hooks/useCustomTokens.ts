/**
 * useCustomTokens — the table's own Library tokens.
 *
 * Reads the shelf off the snapshot (DM-only on the wire, so a player's
 * snapshot simply has none) and sends the two messages that change it. The
 * shelf re-renders from the next snapshot, so there is still no in-flight
 * state worth a spinner — but an ADD now does work before it sends (the 84px
 * thumbnail, drawn and uploaded by customTokenImages), so it is async and
 * hands back the one line the form shows when a step was skipped.
 */

import { useCallback, useMemo } from "react";
import type { ClientMessage, CustomToken, RoomSnapshot } from "@herobyte/shared";
import type { CustomTokenDraft } from "../token-library/customTokensContext";
import {
  browserPrepareDeps,
  prepareCustomImage,
  type PreparedCustomImage,
} from "../token-library/customTokenImages";
import { sessionCredentials } from "../../session/sessionBridge";
import type { AssetUploadCredentials } from "../../map-studio/uploads/assetUpload";

export interface UseCustomTokensOptions {
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  /** Test seams; production uses the real canvas/upload road and the session's credentials. */
  prepareImage?: (imageUrl: string) => Promise<PreparedCustomImage>;
  getCredentials?: () => AssetUploadCredentials | null;
}

/** What an add reports back: nothing at all when every step succeeded. */
export interface CustomTokenAddResult {
  note?: string;
}

export interface UseCustomTokensResult {
  tokens: readonly CustomToken[];
  addToken: (draft: CustomTokenDraft) => Promise<CustomTokenAddResult>;
  removeToken: (id: string) => void;
}

/** One stable empty list, so consumers keyed on identity do not re-render per snapshot. */
const NONE: readonly CustomToken[] = Object.freeze([]);

export function useCustomTokens({
  snapshot,
  sendMessage,
  prepareImage,
  getCredentials = sessionCredentials,
}: UseCustomTokensOptions): UseCustomTokensResult {
  const tokens = snapshot?.customTokens ?? NONE;

  const prepare = useMemo(
    () =>
      prepareImage ??
      ((imageUrl: string) => prepareCustomImage(imageUrl, browserPrepareDeps(getCredentials))),
    [prepareImage, getCredentials],
  );

  const addToken = useCallback(
    async (draft: CustomTokenDraft): Promise<CustomTokenAddResult> => {
      const prepared = await prepare(draft.imageUrl);
      sendMessage({
        t: "add-custom-token",
        name: draft.name,
        imageUrl: prepared.imageUrl,
        ...(prepared.thumbUrl ? { thumbUrl: prepared.thumbUrl } : {}),
        ...(draft.description ? { description: draft.description } : {}),
        tags: draft.tags,
        size: draft.size,
      });
      return prepared.note ? { note: prepared.note } : {};
    },
    [prepare, sendMessage],
  );

  const removeToken = useCallback(
    (id: string) => sendMessage({ t: "remove-custom-token", id }),
    [sendMessage],
  );

  return { tokens, addToken, removeToken };
}
