// ============================================================================
// FRAME PREVIEW — a frame on the token, on a floor (C5a)
// ============================================================================
// One small canvas: a floor (the dark map, the light map, fog), the token's
// picture or colour clipped round, and its frame over it, baked by the same
// worker and cache the map uses (so a preview is also a warm cache for the
// map). Sized so even a frame grown out to its limit fits.

import { useEffect, useRef } from "react";
import { isPolygonShape, type TokenFrame, type TokenSize } from "@herobyte/shared";
import { useFrameBitmap } from "../../render/frame/useFrameBitmap";
import { PROP_SIZE_MULTIPLIERS } from "../../map/propSizing";
import { paintPicture } from "./bake";
import { traceShape } from "./shapeClip";
import type { BackdropFill } from "./backdrop";
import type { CropState, Size } from "./cropMath";

export const PREVIEW_FLOORS = {
  dark: "#2a2622",
  light: "#d8cfbd",
  fog: "#14161c",
} as const;
export type PreviewFloor = keyof typeof PREVIEW_FLOORS;

/** A frame's bitmap reaches 0.7 of the token's edge from its centre at most; a polygon's 0.74 (a grown-out hexagon's corner). */
const MAX_EXTENT = 0.7;
const MAX_POLYGON_EXTENT = 0.74;

export interface FramePreviewProps {
  frame: TokenFrame | null;
  tokenId: string;
  color: string;
  size?: TokenSize;
  imageUrl?: string;
  /** The canvas edge in CSS pixels. */
  edge: number;
  floor: PreviewFloor;
  label: string;
  /** A picture loaded and not yet saved: shown instead of the saved one, as it would bake. */
  pending?: PendingPicture;
  /** False while hidden: nothing is drawn or baked (a crop drag would redraw six canvases). */
  active?: boolean;
}

/** The Picture tab's picture with its crop and backdrop, before it is baked. */
export interface PendingPicture {
  image: HTMLImageElement;
  size: Size;
  crop: CropState;
  fill: BackdropFill;
}

function roundedSquare(
  context: CanvasRenderingContext2D,
  at: number,
  side: number,
  radius: number,
) {
  context.moveTo(at + radius, at);
  context.arcTo(at + side, at, at + side, at + side, radius);
  context.arcTo(at + side, at + side, at, at + side, radius);
  context.arcTo(at, at + side, at, at, radius);
  context.arcTo(at, at, at + side, at, radius);
  context.closePath();
}

export function FramePreview({
  frame,
  tokenId,
  color,
  size,
  imageUrl,
  edge,
  floor,
  label,
  pending,
  active = true,
}: FramePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const token =
    edge / (2 * (frame && isPolygonShape(frame.shape) ? MAX_POLYGON_EXTENT : MAX_EXTENT));
  const drawing = useFrameBitmap(
    frame && active ? { frame, tokenId, color, size, tokenPx: token, zoom: 1 } : null,
  );
  const pictureRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl || typeof Image === "undefined") {
      pictureRef.current = null;
      return;
    }
    // No crossOrigin: the preview only draws the picture, never reads it back.
    const image = new Image();
    image.onload = () => {
      pictureRef.current = image;
      draw();
    };
    image.src = imageUrl;
    return () => {
      image.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draw reads the latest refs
  }, [imageUrl]);

  function draw() {
    const canvas = canvasRef.current;
    const context = active ? canvas?.getContext?.("2d") : null;
    if (!canvas || !context) return;
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(edge * dpr);
    canvas.height = Math.round(edge * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = PREVIEW_FLOORS[floor];
    context.fillRect(0, 0, edge, edge);
    const centre = edge / 2;
    context.save();
    context.beginPath();
    if (frame && isPolygonShape(frame.shape)) traceShape(context, frame.shape, centre, token);
    else if (frame) context.arc(centre, centre, token / 2, 0, Math.PI * 2);
    // Frameless, the map's own rounded square: corners of an eighth of a cell whatever the size.
    else
      roundedSquare(
        context,
        centre - token / 2,
        token,
        token / (6 * (PROP_SIZE_MULTIPLIERS[size ?? "medium"] ?? 1)),
      );
    context.clip();
    if (pending) {
      // Cropped, turned and backed exactly as the bake will paint it.
      context.translate(centre - token / 2, centre - token / 2);
      paintPicture(context, pending.image, pending.size, pending.crop, pending.fill, token);
    } else if (pictureRef.current) {
      const at = centre - token / 2;
      context.drawImage(pictureRef.current, at, at, token, token);
    } else {
      context.fillStyle = color;
      context.fillRect(centre - token / 2, centre - token / 2, token, token);
    }
    context.restore();
    if (drawing?.bitmap) {
      const reach = 2 * drawing.extent * token;
      context.drawImage(drawing.bitmap, centre - reach / 2, centre - reach / 2, reach, reach);
    }
  }

  useEffect(draw);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      width={edge}
      height={edge}
      style={{ width: edge, height: edge, borderRadius: 4, display: "block" }}
    />
  );
}
