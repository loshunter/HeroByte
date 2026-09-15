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
  type PrepareOptions,
  type PreparedCustomImage,
} from "../token-library/customTokenImages";
import { sessionCredentials } from "../../session/sessionBridge";
import type { AssetUploadCredentials } from "../../map-studio/uploads/assetUpload";

export interface UseCustomTokensOptions {
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  /** Test seams; production uses the real canvas/upload road and the session's credentials. */
  prepareImage?: (imageUrl: string, options: PrepareOptions) => Promise<PreparedCustomImage>;
  getCredentials?: () => AssetUploadCredentials | null;
}

/** What the caller wants done to the picture before the token is minted. */
export interface AddCustomTokenOptions {
  /** Keep a copy of an https link on this table. Default on; the form's checkbox. */
  mirror?: boolean;
}

/** What an add reports back: nothing at all when every step succeeded. */
export interface CustomTokenAddResult {
  note?: string;
}

export interface UseCustomTokensResult {
  tokens: readonly CustomToken[];
  addToken: (
    draft: CustomTokenDraft,
    options?: AddCustomTokenOptions,
  ) => Promise<CustomTokenAddResult>;
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
      ((imageUrl: string, options: PrepareOptions) =>
        prepareCustomImage(imageUrl, options, browserPrepareDeps(getCredentials))),
    [prepareImage, getCredentials],
  );

  const addToken = useCallback(
    async (
      draft: CustomTokenDraft,
      options?: AddCustomTokenOptions,
    ): Promise<CustomTokenAddResult> => {
      // Default ON: a link that quietly stops resolving is the failure a DM
      // cannot see coming, and declining the copy costs them one checkbox.
      const prepared = await prepare(draft.imageUrl, { mirror: options?.mirror !== false });
      sendMessage({
        t: "add-custom-token",
        name: draft.name,
        imageUrl: prepared.imageUrl,
        ...(prepared.thumbUrl ? { thumbUrl: prepared.thumbUrl } : {}),
        ...(draft.description ? { description: draft.description } : {}),
        tags: draft.tags,
        size: draft.size,
        ...(draft.disposition ? { disposition: draft.disposition } : {}),
      });
      // `mirrored` was computed on every path and read by nothing, which left
      // the one outcome a DM explicitly asked for — the copy — as the only
      // one with no word at all. It is the confirmation.
      if (prepared.note) return { note: prepared.note };
      return prepared.mirrored ? { note: "A copy of that picture is kept on this table." } : {};
    },
    [prepare, sendMessage],
  );

  const removeToken = useCallback(
    (id: string) => sendMessage({ t: "remove-custom-token", id }),
    [sendMessage],
  );

  return { tokens, addToken, removeToken };
}
