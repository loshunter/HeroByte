// ============================================================================
// TOKEN CREATOR — THE PICTURE TAB
// ============================================================================
// Sources (a file, a link; a drop lands on the window, a paste on the page:
// TokenCreatorWindow), the crop with its turn/flip/zoom controls, the
// backdrop, the preview, and the messages: an error, or a link offered "as
// is". While a save runs, the framing holds still: what is on screen is what
// is being saved.

import { useEffect, useId, useRef, useState } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import { defaultGradient, resolveBackdrop, type Backdrop } from "./backdrop";
import { CropStage } from "./CropStage";
import {
  DEFAULT_CROP,
  ZOOM_MAX,
  flipHorizontal,
  minZoom,
  rotateClockwise,
  zoomAbout,
} from "./cropMath";
import { PicturePreview } from "./PicturePreview";
import { PICTURE_ACCEPT } from "./pictureSources";
import type { TokenCreatorState } from "./useTokenCreator";

interface PictureTabProps {
  creator: TokenCreatorState;
  /** The map's corner radius as a share of the token's side (it depends on size). */
  corner: number;
  /** A polygon frame's shape as a CSS clip-path (C5b): the picture framed in that shape. */
  clip?: string;
  /** Whether this tab is the one showing (an error is brought into view only then). */
  shown?: boolean;
}

// No inline min-height: the phone's 44px floor is a class rule an inline one would beat.
const small = { fontSize: "10px", padding: "6px 10px" } as const;
const label = { color: "var(--jrpg-gold)" } as const;

export function PictureTab({ creator, corner, clip, shown = true }: PictureTabProps) {
  const { picture, crop, setCrop, backdrop, setBackdrop, autoColor, phase } = creator;
  const fileRef = useRef<HTMLInputElement>(null);
  // A failure is said at the foot of the tab, where the sticky Accept bar covers
  // it: the window scrolls to its end to show it, also when the Frame tab turns
  // here. (scrollIntoView counts it as seen under the bar and does not move.)
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!shown || !creator.error) return;
    let scroller = errorRef.current?.parentElement ?? null;
    const scrolls = (node: HTMLElement) => {
      const style = getComputedStyle(node);
      return /(auto|scroll)/.test(style.overflowY || style.overflow);
    };
    while (scroller && !scrolls(scroller)) {
      scroller = scroller.parentElement;
    }
    scroller?.scrollTo?.({ top: scroller.scrollHeight });
  }, [shown, creator.error]);
  const [link, setLink] = useState("");
  const ids = { link: useId(), zoom: useId(), backdrop: useId() };
  const fill = resolveBackdrop(backdrop, autoColor);
  const busy = phase !== "idle";
  const frame: typeof setCrop = (update) => {
    if (!busy) setCrop(update);
  };
  const changeBackdrop = (next: Backdrop) => {
    if (!busy) setBackdrop(next);
  };

  const chooseBackdrop = (kind: Backdrop["kind"]) => {
    if (kind === "solid") changeBackdrop({ kind, color: autoColor });
    else if (kind === "gradient") changeBackdrop({ kind, ...defaultGradient(autoColor) });
    else changeBackdrop({ kind });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <CropStage
        picture={picture}
        crop={crop}
        onCrop={frame}
        fill={fill}
        corner={corner}
        clip={clip}
      />

      {picture && (
        <>
          <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
            <JRPGButton
              onClick={() => frame((c) => rotateClockwise(c, picture.size))}
              aria-disabled={busy}
              title="Turn the picture a quarter turn clockwise"
              style={small}
            >
              ⟳ Rotate
            </JRPGButton>
            <JRPGButton
              onClick={() => frame((c) => flipHorizontal(c, picture.size))}
              aria-disabled={busy}
              title="Mirror the picture left to right"
              style={small}
            >
              ⇋ Flip
            </JRPGButton>
            <JRPGButton
              onClick={() => frame(DEFAULT_CROP)}
              aria-disabled={busy}
              title="Back to the picture covering the square, centred"
              style={small}
            >
              Reset
            </JRPGButton>
          </div>
          <label htmlFor={ids.zoom} className="jrpg-text-small" style={label}>
            Zoom
          </label>
          <input
            id={ids.zoom}
            type="range"
            min={Math.log(minZoom(picture.size))}
            max={Math.log(ZOOM_MAX)}
            step={0.01}
            value={Math.log(crop.zoom)}
            aria-valuetext={`${Math.round(crop.zoom * 100)}%`}
            aria-disabled={busy}
            onChange={(event) => {
              const target = Math.exp(Number(event.target.value));
              frame((c) => zoomAbout(c, picture.size, target / c.zoom));
            }}
          />
        </>
      )}

      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor={ids.backdrop} className="jrpg-text-small" style={label}>
          Backdrop
        </label>
        <select
          id={ids.backdrop}
          className="jrpg-input"
          value={backdrop.kind}
          onChange={(event) => chooseBackdrop(event.target.value as Backdrop["kind"])}
          aria-disabled={busy}
          title="Auto: the average solid colour of the outermost ring of pixels (within a quarter of the way in) that has a real number of solid pixels. None: keep transparency."
          style={{ flex: 1 }}
        >
          <option value="auto">Auto</option>
          <option value="none">None</option>
          <option value="solid">Solid colour</option>
          <option value="gradient">Gradient</option>
        </select>
        {backdrop.kind === "solid" && (
          <input
            type="color"
            aria-label="Backdrop colour"
            value={backdrop.color}
            onChange={(event) => changeBackdrop({ kind: "solid", color: event.target.value })}
          />
        )}
        {backdrop.kind === "gradient" && (
          <>
            <input
              type="color"
              aria-label="Gradient top colour"
              value={backdrop.from}
              onChange={(event) => changeBackdrop({ ...backdrop, from: event.target.value })}
            />
            <input
              type="color"
              aria-label="Gradient bottom colour"
              value={backdrop.to}
              onChange={(event) => changeBackdrop({ ...backdrop, to: event.target.value })}
            />
          </>
        )}
      </div>

      {picture && (
        <PicturePreview picture={picture} crop={crop} fill={fill} corner={corner} clip={clip} />
      )}

      <input
        ref={fileRef}
        type="file"
        accept={PICTURE_ACCEPT}
        aria-label="Token picture file"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void creator.loadFile(file);
          event.target.value = "";
        }}
      />
      <JRPGButton
        onClick={() => {
          if (!busy) fileRef.current?.click();
        }}
        aria-disabled={busy}
        style={{ fontSize: "10px", padding: "8px", minHeight: "44px" }}
      >
        {phase === "loading" ? "Loading…" : picture ? "⬆ Choose another file" : "⬆ Choose a file"}
      </JRPGButton>
      <label htmlFor={ids.link} className="jrpg-text-small" style={label}>
        Or a link to a picture
      </label>
      <div style={{ display: "flex", gap: "6px" }}>
        <input
          id={ids.link}
          className="jrpg-input"
          type="text"
          value={link}
          placeholder="https://i.imgur.com/…"
          onChange={(event) => {
            setLink(event.target.value);
            creator.forgetFailedLink();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void creator.loadLink(link);
          }}
          style={{ flex: 1, minWidth: 0, padding: "4px" }}
        />
        <JRPGButton onClick={() => void creator.loadLink(link)} style={small}>
          Load link
        </JRPGButton>
      </div>

      {creator.unbakeable && (
        <p
          role="status"
          className="jrpg-text-small"
          style={{ margin: 0, color: "var(--jrpg-white)" }}
        >
          {creator.unbakeable.reason === "no-copy"
            ? "That site does not let HeroByte copy its pictures, so it cannot be framed here."
            : "That link did not load a picture: check the address. Links show at the table only from Imgur (i.imgur.com), Discord (media.discordapp.net) and pictures already on this HeroByte server."}
        </p>
      )}
      {/* Today's way, never taken away: the link itself, unframed, nothing uploaded. */}
      {creator.linkAsIs && (
        <JRPGButton
          onClick={creator.applyLinkAsIs}
          title="Set this picture's link itself (an imgur.com page becomes its image link): no framing, and nothing saved to the table"
          style={small}
        >
          Use the link as is
        </JRPGButton>
      )}
      {creator.error && (
        <p
          ref={errorRef}
          className="jrpg-text-small"
          role="alert"
          style={{ margin: 0, color: "var(--jrpg-danger, #ff6b6b)" }}
        >
          {creator.error}
        </p>
      )}
    </div>
  );
}
