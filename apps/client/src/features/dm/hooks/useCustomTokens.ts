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

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ClientMessage, CustomToken, RoomSnapshot } from "@herobyte/shared";
import { CUSTOM_TOKEN_LIMITS, isCustomTokenImageUrl } from "@herobyte/shared";
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
  /** How long to wait for the shelf to grow before saying it did not. */
  confirmTimeoutMs?: number;
}

/** What the caller wants done to the picture before the token is minted. */
export interface AddCustomTokenOptions {
  /** Keep a copy of an https link on this table. Default on; the form's checkbox. */
  mirror?: boolean;
}

/** What an add reports back. */
export interface CustomTokenAddResult {
  /** False when the token never reached the shelf — the form keeps the fields. */
  added: boolean;
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
  confirmTimeoutMs = 5000,
}: UseCustomTokensOptions): UseCustomTokensResult {
  const tokens = snapshot?.customTokens ?? NONE;

  // The LATEST shelf, readable from inside an in-flight add. The add is async
  // now, so the `tokens` captured when it started is stale by the time the
  // server has answered.
  const tokensRef = useRef(tokens);
  useEffect(() => {
    tokensRef.current = tokens;
  });

  const prepare = useMemo(
    () =>
      prepareImage ??
      ((imageUrl: string, options: PrepareOptions) =>
        prepareCustomImage(imageUrl, options, browserPrepareDeps(getCredentials))),
    [prepareImage, getCredentials],
  );

  /** Resolves true when the shelf reaches `target`, false at the deadline. */
  const grewBy = useCallback(
    async (target: number) => {
      const deadline = Date.now() + confirmTimeoutMs;
      while (tokensRef.current.length < target) {
        if (Date.now() >= deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return true;
    },
    [confirmTimeoutMs],
  );

  const addToken = useCallback(
    async (
      draft: CustomTokenDraft,
      options?: AddCustomTokenOptions,
    ): Promise<CustomTokenAddResult> => {
      // BEFORE any upload. A refusal is a server-side log — nothing comes back
      // — so an address the wire will drop used to cost two uploads against
      // the table's quota and then look exactly like a success.
      if (!isCustomTokenImageUrl(draft.imageUrl.trim())) {
        return {
          added: false,
          note: "That address cannot be used: it needs to be an https link, or an image uploaded to this table.",
        };
      }
      if (tokensRef.current.length >= CUSTOM_TOKEN_LIMITS.COUNT_MAX) {
        return {
          added: false,
          note: `This table already holds its ${CUSTOM_TOKEN_LIMITS.COUNT_MAX} own tokens. Remove one to add another.`,
        };
      }

      const before = tokensRef.current.length;
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
      // Watch the shelf, the way "+ Add NPC" watches the character count. The
      // send is fire-and-forget with no commandId, so a validator refusal, a
      // revoked DM role or a dropped socket all end in silence — and silence
      // looked identical to success, because the form clears either way.
      if (!(await grewBy(before + 1))) {
        return {
          added: false,
          note: "The table did not take that token. Check the image and try again.",
        };
      }
      // `mirrored` was computed on every path and read by nothing, which left
      // the one outcome a DM explicitly asked for — the copy — as the only
      // one with no word at all. It is the confirmation.
      if (prepared.note) return { added: true, note: prepared.note };
      return prepared.mirrored
        ? { added: true, note: "A copy of that picture is kept on this table." }
        : { added: true };
    },
    [grewBy, prepare, sendMessage],
  );

  const removeToken = useCallback(
    (id: string) => sendMessage({ t: "remove-custom-token", id }),
    [sendMessage],
  );

  return { tokens, addToken, removeToken };
}
