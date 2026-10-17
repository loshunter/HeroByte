// ============================================================================
// TABLE PROVIDERS — what every control at the table can reach
// ============================================================================
// The voice call (VoiceContext) and the token-frame sender (C5a), handed to
// the controls that need them without threading them through the layouts.

import { useCallback, type ReactNode } from "react";
import type { ClientMessage, TokenFrame } from "@herobyte/shared";
import { VoiceContext, type VoiceContextValue } from "../voice/VoiceContext";
import { TokenFrameSenderContext } from "../players/token-creator/frameControl";

export function TableProviders({
  voice,
  sendMessage,
  children,
}: {
  voice: VoiceContextValue | null;
  sendMessage: (message: ClientMessage) => void;
  children: ReactNode;
}) {
  const sendFrame = useCallback(
    (tokenId: string, frame: TokenFrame | null) =>
      sendMessage({ t: "set-token-frame", tokenId, frame }),
    [sendMessage],
  );
  return (
    <VoiceContext.Provider value={voice}>
      <TokenFrameSenderContext.Provider value={sendFrame}>
        {children}
      </TokenFrameSenderContext.Provider>
    </VoiceContext.Provider>
  );
}
