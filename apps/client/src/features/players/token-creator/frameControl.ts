// ============================================================================
// TOKEN FRAME CONTROL — what a card hands its settings window (C5a)
// ============================================================================
// The Frame tab needs the token (its id, frame, colour, size and picture, for
// the preview) and a way to send `set-token-frame`. The sending comes from the
// table (TableProviders), so no layout threads it; a card builds the control
// from its token and its own gate (the owner or the DM: the server checks
// again) with useTokenFrameControl, and a window without one shows no Frame tab.

import { createContext, useContext, useMemo } from "react";
import type { TokenFrame, TokenSize } from "@herobyte/shared";

export type SendTokenFrame = (tokenId: string, frame: TokenFrame | null) => void;

export const TokenFrameSenderContext = createContext<SendTokenFrame | null>(null);

export interface TokenFrameControl {
  tokenId: string;
  frame?: TokenFrame;
  color: string;
  size?: TokenSize;
  imageUrl?: string;
  onApply: (frame: TokenFrame | null) => void;
}

/** The parts of a token (or its scene object's data) the Frame tab reads. */
export interface FramedTokenView {
  id: string;
  frame?: TokenFrame;
  color: string;
  size?: TokenSize;
  imageUrl?: string;
}

export function useTokenFrameControl(
  token: FramedTokenView | null | undefined,
  mayEdit: boolean,
): TokenFrameControl | undefined {
  const send = useContext(TokenFrameSenderContext);
  const id = token?.id;
  const frame = token?.frame;
  const color = token?.color;
  const size = token?.size;
  const imageUrl = token?.imageUrl;
  return useMemo(() => {
    if (!send || !mayEdit || !id || color === undefined) return undefined;
    return { tokenId: id, frame, color, size, imageUrl, onApply: (next) => send(id, next) };
  }, [send, mayEdit, id, frame, color, size, imageUrl]);
}
