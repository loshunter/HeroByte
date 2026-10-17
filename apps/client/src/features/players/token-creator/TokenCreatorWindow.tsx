// ============================================================================
// TOKEN CREATOR — THE WINDOW (C4)
// ============================================================================
// A DraggableWindow (a full-screen takeover on phones) above the settings
// window that opened it, with two tabs: Picture, and Frame (C5a) when the
// card hands it a frame control. Each tab has its own Accept: a picture is
// baked and uploaded, a frame is sent as it is, and a frame picked goes with
// a picture only once the picture is on the token, so Cancel or a failed save
// leaves the token as it was. Escape and ✕ close it like Cancel, and abandon a
// save in flight (useTokenCreator). While it is open, `data-modal-overlay`
// keeps WASD from moving a token, a pasted image lands here (in the creator
// opened last, when two are open), and a file dropped anywhere on the window,
// title bar and frame included, loads instead of opening in the tab.

import { useEffect, useId, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { createPortal } from "react-dom";
import type { TokenFrame, TokenSize } from "@herobyte/shared";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { PROP_SIZE_MULTIPLIERS } from "../../map/propSizing";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { isEditableTarget } from "../../../utils/isEditableTarget";
import { pictureFileFrom } from "./pictureSources";
import { PictureTab } from "./PictureTab";
import { FrameTab } from "./FrameTab";
import type { TokenFrameControl } from "./frameControl";
import { useTokenCreator, type TokenCreatorDeps } from "./useTokenCreator";
import { resolveBackdrop } from "./backdrop";
import { acceptLabels } from "./acceptLabels";

/** Open creators, oldest first: a paste goes to the last one opened. */
const openCreators: symbol[] = [];

export interface TokenCreatorWindowProps {
  /** Whose token, for the title ("Token picture: Eldryn"). */
  name?: string;
  tokenSize?: TokenSize;
  onApply: (url: string) => void;
  onClose: () => void;
  deps?: TokenCreatorDeps;
  /** The token's frame and how to set it: present, the window has a Frame tab (C5a). */
  frame?: TokenFrameControl;
  /** Which tab opens first. */
  initialTab?: CreatorTab;
  /** Goes up with every press of the settings window's buttons: each press turns to `initialTab`. */
  tabRequest?: number;
}

type CreatorTab = "picture" | "frame";

export function TokenCreatorWindow({
  name,
  tokenSize,
  onApply,
  onClose,
  deps,
  frame,
  initialTab = "picture",
  tabRequest = 0,
}: TokenCreatorWindowProps) {
  // Untouched (undefined), the draft IS the token's frame, whatever a sync
  // brings meanwhile, and is never sent: a copy kept in step by an effect was
  // the old frame for one render after a sync, long enough to be sent back.
  const [picked, setDraft] = useState<TokenFrame | null | undefined>(undefined);
  const draft = picked === undefined ? (frame?.frame ?? null) : picked;
  const edited = picked !== undefined;
  const latest = useRef({ draft, frame, edited });
  latest.current = { draft, frame, edited };
  // A picture that lands (baked, or its link as is) takes the frame picked by
  // then along: read at that moment, so one picked while it uploads still goes.
  const applyPicture = (url: string) => {
    onApply(url);
    const now = latest.current;
    if (now.frame && now.edited && now.draft !== (now.frame.frame ?? null)) {
      now.frame.onApply(now.draft);
    }
  };
  const creator = useTokenCreator({ tokenSize, onApply: applyPicture, onDone: onClose, deps });
  const [tab, setTab] = useState<CreatorTab>(frame ? initialTab : "picture");
  const ids = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // The settings window's other button, pressed while this is open, turns the tab.
  useEffect(() => setTab(frame ? initialTab : "picture"), [initialTab, tabRequest]); // eslint-disable-line react-hooks/exhaustive-deps -- the tab follows the button, not the control
  const loadFileRef = useRef(creator.loadFile);
  loadFileRef.current = creator.loadFile;
  const loadDroppedRef = useRef(creator.loadDropped);
  loadDroppedRef.current = creator.loadDropped;

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
      setTab("picture"); // a picture lands where it can be seen and framed
      void loadFileRef.current(file);
    };
    // A file let go just outside the window would open in the tab in place of
    // the table: while a creator is open, a file dropped anywhere on the page
    // goes to the newest creator instead (the window's own drop runs first).
    const carriesFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes("Files");
    const onDragOver = (event: DragEvent) => {
      if (carriesFiles(event)) event.preventDefault();
    };
    const onDocumentDrop = (event: DragEvent) => {
      if (event.defaultPrevented || !carriesFiles(event)) return;
      event.preventDefault();
      if (openCreators[openCreators.length - 1] !== me) return;
      setTab("picture");
      loadDroppedRef.current(event.dataTransfer);
    };
    document.addEventListener("paste", onPaste);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDocumentDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDocumentDrop);
      openCreators.splice(openCreators.indexOf(me), 1);
    };
  }, []);

  // The whole window is the drop target, title bar and frame too (they sit
  // outside the content box, inside the display:contents wrapper): a file
  // dropped on it must not reach the browser, which would open it in place of
  // the table.
  const onDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    // Text dragged within the link field stays the field's own business.
    if (isEditableTarget(event.target) && !pictureFileFrom(event.dataTransfer)) return;
    event.preventDefault();
    setTab("picture");
    creator.loadDropped(event.dataTransfer);
  };

  // The map draws a token 3/4 of a cell times its size, with corners of 1/8 of a
  // cell whatever its size: the corner, as a share of the side, shrinks with size.
  // A framed token is round on the map (C5a), so its picture is framed in a circle.
  const corner = (frame ? draft : null)
    ? 0.5
    : 1 / (6 * (PROP_SIZE_MULTIPLIERS[tokenSize ?? "medium"] ?? 1));
  const tabs: readonly CreatorTab[] = frame ? ["picture", "frame"] : ["picture"];
  const onTabKey = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next =
      tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
    setTab(next);
    tabRefs.current[next]?.focus(); // this window's tab, not another creator's
  };
  const shown: CreatorTab = frame ? tab : "picture";
  // Each Accept takes the other tab's unsaved work along, and its label says so.
  const draftChanged = frame !== undefined && edited && draft !== (frame.frame ?? null);
  const idle = creator.phase === "idle";
  const ready = creator.picture !== null && idle;
  const labels = acceptLabels({
    phase: creator.phase,
    hasPicture: creator.picture !== null,
    hasFrame: draft !== null,
    frameChanged: draftChanged,
  });
  const pending = creator.picture
    ? {
        image: creator.picture.image,
        size: creator.picture.size,
        crop: creator.crop,
        fill: resolveBackdrop(creator.backdrop, creator.autoColor),
      }
    : undefined;

  return createPortal(
    <div
      style={{ display: "contents" }}
      data-mobile-surface="token-creator"
      data-modal-overlay=""
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <DraggableWindow
        title={`🖼️ ${frame ? "Art & frame" : "Token picture"}${name ? `: ${name}` : ""}`}
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
          <div
            role="tablist"
            aria-label="Token creator"
            onKeyDown={onTabKey}
            style={{ display: "flex", gap: "4px" }}
          >
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={shown === id}
                tabIndex={shown === id ? 0 : -1}
                ref={(node) => {
                  tabRefs.current[id] = node;
                }}
                id={`${ids}-tab-${id}`}
                aria-controls={`${ids}-panel-${id}`}
                className="jrpg-button"
                onClick={() => setTab(id)}
                style={{ fontSize: "10px", padding: "6px 12px", opacity: shown === id ? 1 : 0.7 }}
              >
                {id === "picture" ? "Picture" : "Frame"}
              </button>
            ))}
          </div>
          {/* Both panels stay mounted (the hidden one keeps its state): the tabs only show one. */}
          <div
            role="tabpanel"
            id={`${ids}-panel-picture`}
            aria-labelledby={`${ids}-tab-picture`}
            hidden={shown !== "picture"}
          >
            <PictureTab creator={creator} corner={corner} />
          </div>
          {frame && (
            <div
              role="tabpanel"
              id={`${ids}-panel-frame`}
              aria-labelledby={`${ids}-tab-frame`}
              hidden={shown !== "frame"}
            >
              <FrameTab
                control={frame}
                active={shown === "frame"}
                pending={pending}
                draft={draft}
                onDraft={setDraft}
              />
            </div>
          )}
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
            {shown === "frame" && frame ? (
              <JRPGButton
                variant="primary"
                onClick={() => {
                  // A picture saving takes this frame along when it lands (applyPicture).
                  if (!idle) return;
                  if (!creator.picture) {
                    frame.onApply(draft);
                    onClose();
                    return;
                  }
                  // The picture first, the frame with it; a failure shows on its tab.
                  void creator.accept().then((saved) => {
                    if (!saved) setTab("picture");
                  });
                }}
                aria-disabled={!idle}
                title={labels.frameTitle}
                style={{ flex: 2, fontSize: "11px", padding: "8px", minHeight: "44px" }}
              >
                {labels.frame}
              </JRPGButton>
            ) : (
              <JRPGButton
                variant="primary"
                onClick={() => void creator.accept()}
                aria-disabled={!ready}
                title={labels.pictureTitle}
                // Two lines in a 340 px window: give them room to stand apart.
                style={{
                  flex: 2,
                  fontSize: "11px",
                  padding: "8px",
                  minHeight: "44px",
                  lineHeight: 1.5,
                }}
              >
                {labels.picture}
              </JRPGButton>
            )}
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
