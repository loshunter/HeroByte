// ============================================================================
// FRAME PREVIEW — a frame on the token, on a floor (C5a)
// ============================================================================
// One small canvas: a floor (the dark map, the light map, fog), the token's
// picture or colour clipped round, and its frame over it, baked by the same
// worker and cache the map uses (so a preview is also a warm cache for the
// map). Sized so even a frame grown out to its limit fits.

import { useEffect, useRef } from "react";
import type { TokenFrame, TokenSize } from "@herobyte/shared";
import { useFrameBitmap } from "../../render/frame/useFrameBitmap";

export const PREVIEW_FLOORS = {
  dark: "#2a2622",
  light: "#d8cfbd",
  fog: "#14161c",
} as const;
export type PreviewFloor = keyof typeof PREVIEW_FLOORS;

/** A frame's bitmap reaches 0.7 of the token's edge from its centre at most. */
const MAX_EXTENT = 0.7;

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
}: FramePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const token = edge / (2 * MAX_EXTENT);
  const drawing = useFrameBitmap(
    frame ? { frame, tokenId, color, size, tokenPx: token, zoom: 1 } : null,
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
    const context = canvas?.getContext?.("2d");
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
    if (frame) context.arc(centre, centre, token / 2, 0, Math.PI * 2);
    // Frameless, the map's own rounded square: corners of an eighth of a cell, a sixth of the token.
    else roundedSquare(context, centre - token / 2, token, token / 6);
    context.clip();
    if (pictureRef.current) {
      context.drawImage(pictureRef.current, centre - token / 2, centre - token / 2, token, token);
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
