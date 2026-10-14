// ============================================================================
// TOKEN CREATOR — THE PICTURE TAB
// ============================================================================
// Sources (file, link; drop and paste land on the crop area and the window),
// the crop with its turn/flip/zoom controls, the backdrop, the preview, and
// the two messages: an error, or a link offered "as is".

import { useId, useRef, useState } from "react";
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
  color?: string;
}

// No inline min-height: the phone's 44px floor is a class rule an inline one would beat.
const small = { fontSize: "10px", padding: "6px 10px" } as const;
const label = { color: "var(--jrpg-gold)" } as const;

export function PictureTab({ creator, color }: PictureTabProps) {
  const { picture, crop, setCrop, backdrop, setBackdrop, autoColor, phase } = creator;
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const ids = { link: useId(), zoom: useId(), backdrop: useId() };
  const fill = resolveBackdrop(backdrop, autoColor);
  const busy = phase !== "idle";

  const chooseBackdrop = (kind: Backdrop["kind"]) => {
    if (kind === "solid") setBackdrop({ kind, color: autoColor });
    else if (kind === "gradient") setBackdrop({ kind, ...defaultGradient(autoColor) });
    else setBackdrop({ kind });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <CropStage picture={picture} crop={crop} onCrop={setCrop} fill={fill} />

      {picture && (
        <>
          <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "wrap" }}>
            <JRPGButton
              onClick={() => setCrop((c) => rotateClockwise(c, picture.size))}
              title="Turn the picture a quarter turn clockwise"
              style={small}
            >
              ⟳ Rotate
            </JRPGButton>
            <JRPGButton
              onClick={() => setCrop((c) => flipHorizontal(c, picture.size))}
              title="Mirror the picture left to right"
              style={small}
            >
              ⇋ Flip
            </JRPGButton>
            <JRPGButton
              onClick={() => setCrop(DEFAULT_CROP)}
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
            onChange={(event) => {
              const target = Math.exp(Number(event.target.value));
              setCrop((c) => zoomAbout(c, picture.size, target / c.zoom));
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
          title="Auto: the colour at the picture's edge. None: keep transparency."
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
            onChange={(event) => setBackdrop({ kind: "solid", color: event.target.value })}
          />
        )}
        {backdrop.kind === "gradient" && (
          <>
            <input
              type="color"
              aria-label="Gradient top colour"
              value={backdrop.from}
              onChange={(event) => setBackdrop({ ...backdrop, from: event.target.value })}
            />
            <input
              type="color"
              aria-label="Gradient bottom colour"
              value={backdrop.to}
              onChange={(event) => setBackdrop({ ...backdrop, to: event.target.value })}
            />
          </>
        )}
      </div>

      {picture && <PicturePreview picture={picture} crop={crop} fill={fill} color={color} />}

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
          onChange={(event) => setLink(event.target.value)}
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
            : "That link did not load a picture: check the address. Only Imgur and Discord links show at the table."}
        </p>
      )}
      {/* Today's way, never taken away: the link itself, unframed, nothing uploaded. */}
      {creator.linkAsIs && (
        <JRPGButton
          onClick={creator.applyLinkAsIs}
          title="Set the link exactly as given: no framing, and no copy on the table"
          style={small}
        >
          Use the link as is
        </JRPGButton>
      )}
      {creator.error && (
        <p
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
