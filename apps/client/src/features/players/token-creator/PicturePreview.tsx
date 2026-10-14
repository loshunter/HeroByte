// ============================================================================
// TOKEN CREATOR — PREVIEW
// ============================================================================
// The result at token size, drawn as the map draws a picture today: a rounded
// square (the map's token is 3/4 of a cell with corners of 1/8 of a cell, so
// 1/6 of its side), with no outline (the map strokes a picture only for your
// own token, in white, or a selection, in the viewer's colour), on a dark map,
// a light map and under fog. C5a replaces the square with the frame.

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
}

export function PicturePreview({ picture, crop, fill }: PicturePreviewProps) {
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
                borderRadius: TOKEN / 6,
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
