// ============================================================================
// TOKEN CREATOR — THE WINDOW (C4)
// ============================================================================
// A DraggableWindow (a full-screen takeover on phones) above the settings
// window that opened it, with a tab strip that holds one tab today, Picture;
// C5a adds Frame beside it. Escape and ✕ close it like Cancel, and abandon a
// save in flight (useTokenCreator). While it is open, `data-modal-overlay`
// keeps WASD from moving a token, a pasted image lands here (in the creator
// opened last, when two are open), and a file dropped anywhere on the window,
// title bar and frame included, loads instead of opening in the tab.

import { useEffect, useRef, type DragEvent } from "react";
import { createPortal } from "react-dom";
import type { TokenSize } from "@herobyte/shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { isEditableTarget } from "../../../utils/isEditableTarget";
import { pictureFileFrom } from "./pictureSources";
import { PictureTab } from "./PictureTab";
import { useTokenCreator, type TokenCreatorDeps } from "./useTokenCreator";

/** Open creators, oldest first: a paste goes to the last one opened. */
const openCreators: symbol[] = [];

export interface TokenCreatorWindowProps {
  /** Whose token, for the title ("Token picture: Eldryn"). */
  name?: string;
  tokenSize?: TokenSize;
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
  onApply,
  onClose,
  deps,
}: TokenCreatorWindowProps) {
  const creator = useTokenCreator({ tokenSize, onApply, onDone: onClose, deps });
  const loadFileRef = useRef(creator.loadFile);
  loadFileRef.current = creator.loadFile;

  // Paste an image anywhere while the creator is open. A paste that carries
  // text into a text field stays text (cells copied from a spreadsheet bring a
  // picture of themselves along), and only the newest creator takes it.
  useEffect(() => {
    const me = Symbol("token-creator");
    openCreators.push(me);
    const onPaste = (event: ClipboardEvent) => {
      if (openCreators[openCreators.length - 1] !== me) return;
      const text = event.clipboardData?.getData?.("text/plain") ?? "";
      if (text && isEditableTarget(event.target)) return;
      const file = pictureFileFrom(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      void loadFileRef.current(file);
    };
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("paste", onPaste);
      openCreators.splice(openCreators.indexOf(me), 1);
    };
  }, []);

  // The whole window is the drop target, title bar and frame too (they sit
  // outside the content box, inside the display:contents wrapper): a file
  // dropped on it must not reach the browser, which would open it in place of
  // the table.
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    creator.loadDropped(event.dataTransfer);
  };

  const ready = creator.picture !== null && creator.phase === "idle";

  return createPortal(
    <div
      style={{ display: "contents" }}
      data-mobile-surface="token-creator"
      data-modal-overlay=""
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <DraggableWindow
        title={name ? `🖼️ Token picture: ${name}` : "🖼️ Token picture"}
        onClose={onClose}
        interaction={{ behavior: "close", panel: "character" }}
        initialX={600}
        initialY={100}
        width={340}
        minWidth={320}
        maxWidth={380}
        storageKey={name ? `token-creator:${name}` : "token-creator"}
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
            <PictureTab creator={creator} />
          </div>
          {/* Pinned to the window's foot: on a short screen the picture scrolls, not Accept. */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              position: "sticky",
              bottom: 0,
              padding: "8px 0",
              background: "rgba(12, 18, 40, 0.97)",
            }}
          >
            <JRPGButton
              variant="primary"
              onClick={() => void creator.accept()}
              aria-disabled={!ready}
              title={
                creator.picture ? "Bake, upload and set this picture" : "Choose a picture first"
              }
              // Two lines in a 340 px window: give them room to stand apart.
              style={{
                flex: 2,
                fontSize: "11px",
                padding: "8px",
                minHeight: "44px",
                lineHeight: 1.5,
              }}
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
