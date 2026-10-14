// ============================================================================
// TOKEN CREATOR — PREVIEW
// ============================================================================
// The result at token size, drawn as the map draws a picture today: a rounded
// square (corner radius an eighth of the cell) with the token's stroke, on a
// dark map, a light map and under fog. C5a replaces the square with the frame.

import type { CSSProperties } from "react";
import { cssBackground, type BackdropFill } from "./backdrop";
import { cssPlacement, placementFor, type CropState } from "./cropMath";
import type { LoadedPicture } from "./pictureSources";

const TILE = 64;
const TOKEN = 44;

const GROUNDS: Array<{ name: string; ground: string; fog?: string }> = [
  { name: "Dark map", ground: "#1f1d1a" },
  { name: "Light map", ground: "#cdbf9d" },
  { name: "Under fog", ground: "#1f1d1a", fog: "rgba(8, 8, 16, 0.55)" },
];

interface PicturePreviewProps {
  picture: LoadedPicture;
  crop: CropState;
  fill: BackdropFill;
  /** The token's stroke colour, when it has one. */
  color?: string;
}

export function PicturePreview({ picture, crop, fill, color }: PicturePreviewProps) {
  const placed = cssPlacement(placementFor(crop, picture.size, 100));
  const imageStyle: CSSProperties = {
    position: "absolute",
    left: `${placed.left}%`,
    top: `${placed.top}%`,
    width: `${placed.width}%`,
    height: `${placed.height}%`,
    transform: placed.transform,
    maxWidth: "none",
  };
  return (
    <div
      role="group"
      aria-label="Preview at token size"
      style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}
    >
      {GROUNDS.map(({ name, ground, fog }) => (
        <figure key={name} style={{ margin: 0, textAlign: "center" }}>
          <div
            style={{
              position: "relative",
              width: TILE,
              height: TILE,
              background: ground,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
            }}
          >
            <div
              style={{
                position: "relative",
                width: TOKEN,
                height: TOKEN,
                overflow: "hidden",
                borderRadius: TOKEN / 8,
                outline: `2px solid ${color ?? "var(--jrpg-border-gold)"}`,
                background: cssBackground(fill),
              }}
            >
              <img src={picture.displaySrc} alt="" draggable={false} style={imageStyle} />
            </div>
            {fog && (
              <div
                aria-hidden
                style={{ position: "absolute", inset: 0, background: fog, borderRadius: "4px" }}
              />
            )}
          </div>
          <figcaption className="jrpg-text-small" style={{ fontSize: "9px", marginTop: "2px" }}>
            {name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
