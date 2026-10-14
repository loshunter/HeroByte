// ============================================================================
// TOKEN CREATOR — THE WINDOW (C4)
// ============================================================================
// A DraggableWindow (a full-screen takeover on phones) above the settings
// window that opened it, with a tab strip that holds one tab today, Picture;
// C5a adds Frame beside it. Escape and ✕ close it like Cancel: nothing is
// uploaded and nothing changes. While it is open, `data-modal-overlay` keeps
// WASD from moving a token, and a pasted image anywhere lands here.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { TokenSize } from "@herobyte/shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { pictureFileFrom } from "./pictureSources";
import { PictureTab } from "./PictureTab";
import { useTokenCreator, type TokenCreatorDeps } from "./useTokenCreator";

export interface TokenCreatorWindowProps {
  /** Whose token, for the title ("Token picture: Eldryn"). */
  name?: string;
  tokenSize?: TokenSize;
  /** The token's stroke colour, for the preview. */
  color?: string;
  onApply: (url: string) => void;
  onClose: () => void;
  deps?: TokenCreatorDeps;
}

const PHASE_LABEL = {
  idle: "Use this picture",
  loading: "Loading…",
  baking: "Baking…",
  uploading: "Uploading…",
};

export function TokenCreatorWindow({
  name,
  tokenSize,
  color,
  onApply,
  onClose,
  deps,
}: TokenCreatorWindowProps) {
  const creator = useTokenCreator({ tokenSize, onApply, onDone: onClose, deps });
  const { loadFile } = creator;

  // Paste an image anywhere while the creator is open. Text pasted into the
  // link field stays text.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = pictureFileFrom(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void loadFile(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [loadFile]);

  const ready = creator.picture !== null && creator.phase === "idle";

  return createPortal(
    <div style={{ display: "contents" }} data-mobile-surface="token-creator" data-modal-overlay="">
      <DraggableWindow
        title={name ? `🖼️ Token picture: ${name}` : "🖼️ Token picture"}
        onClose={onClose}
        interaction={{ behavior: "close", panel: "character" }}
        initialX={600}
        initialY={100}
        width={340}
        minWidth={320}
        maxWidth={380}
        storageKey="token-creator"
        zIndex={2600}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "12px",
            background: "rgba(12, 18, 40, 0.97)",
          }}
        >
          <div role="tablist" aria-label="Token creator" style={{ display: "flex", gap: "4px" }}>
            <button
              type="button"
              role="tab"
              aria-selected="true"
              id="token-creator-tab-picture"
              aria-controls="token-creator-panel-picture"
              className="jrpg-button"
              style={{ fontSize: "10px", padding: "6px 12px" }}
            >
              Picture
            </button>
          </div>
          <div
            role="tabpanel"
            id="token-creator-panel-picture"
            aria-labelledby="token-creator-tab-picture"
          >
            <PictureTab creator={creator} color={color} />
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <JRPGButton
              variant="primary"
              onClick={() => void creator.accept()}
              aria-disabled={!ready}
              title={
                creator.picture ? "Bake, upload and set this picture" : "Choose a picture first"
              }
              style={{ flex: 2, fontSize: "11px", padding: "8px", minHeight: "44px" }}
            >
              {PHASE_LABEL[creator.phase]}
            </JRPGButton>
            <JRPGButton
              onClick={onClose}
              style={{ flex: 1, fontSize: "11px", padding: "8px", minHeight: "44px" }}
            >
              Cancel
            </JRPGButton>
          </div>
        </div>
      </DraggableWindow>
    </div>,
    document.body,
  );
}

export default TokenCreatorWindow;
