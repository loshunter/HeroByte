// ============================================================================
// TOKEN CREATOR — THE BAKE
// ============================================================================
// Crop, turn, flip and backdrop into one full-bleed square, encoded as WebP
// (PNG where the engine cannot encode WebP). Full-bleed so a frame chosen
// later (C5a) clips the square and never re-crops the picture.
//
// Always baked at the full edge (512, or 768 for Huge and Gargantuan), even
// from a smaller source: the map scales the picture to the token box anyway,
// so a smaller bake is no sharper, and one edge per size keeps the frame
// engine's input fixed. Smooth upscaled art costs WebP very little. The edge
// is chosen at bake time: a later size change does not re-bake.
//
// The canvas and its encoder are injected, so this runs under jsdom (which
// has no 2D canvas) with a recording fake.

import type { TokenSize } from "@herobyte/shared";
import type { BackdropFill } from "./backdrop";
import { placementFor, type CropState, type Size } from "./cropMath";

export const BAKE_EDGE = 512;
export const BAKE_EDGE_LARGE = 768;
export const WEBP_QUALITY = 0.85;

export function bakeEdgeFor(size: TokenSize | undefined): number {
  return size === "huge" || size === "gargantuan" ? BAKE_EDGE_LARGE : BAKE_EDGE;
}

/** The slice of a 2D context the bake uses (a fake records these in tests). */
export interface BakeContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: ImageSmoothingQuality;
  fillRect(x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  rotate(radians: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
}

export interface BakeCanvas {
  width: number;
  height: number;
  getContext(kind: "2d"): BakeContext | null;
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

export interface BakeDeps {
  createCanvas: (edge: number) => BakeCanvas;
}

export interface BakedPicture {
  blob: Blob;
  mime: "image/webp" | "image/png";
  fileName: string;
  edge: number;
}

/** The canvas refused to export: a picture from a site that did not allow it. */
export class TaintedPictureError extends Error {
  constructor() {
    super("That picture's site does not allow HeroByte to copy it.");
    this.name = "TaintedPictureError";
  }
}

function toBlob(canvas: BakeCanvas, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(resolve, type, quality);
    } catch (error) {
      // A tainted canvas throws SecurityError synchronously.
      reject(
        error instanceof Error && error.name === "SecurityError"
          ? new TaintedPictureError()
          : error,
      );
    }
  });
}

/**
 * WebP first; READ the blob's type, because Safari answers a WebP request with
 * a PNG and no error. A PNG answer is kept and named as one; anything else
 * (no type at all) is encoded again, explicitly as PNG.
 */
export async function encodePicture(
  canvas: BakeCanvas,
): Promise<{ blob: Blob; mime: "image/webp" | "image/png" }> {
  const webp = await toBlob(canvas, "image/webp", WEBP_QUALITY);
  if (webp?.type === "image/webp") return { blob: webp, mime: "image/webp" };
  if (webp?.type === "image/png") return { blob: webp, mime: "image/png" };
  const png = await toBlob(canvas, "image/png");
  if (!png) throw new Error("This browser could not encode the picture.");
  // Typeless but asked for PNG: label it so the upload's type check agrees.
  return {
    blob: png.type === "image/png" ? png : new Blob([png], { type: "image/png" }),
    mime: "image/png",
  };
}

/** Paint the backdrop and the placed picture onto a context. */
export function paintPicture(
  context: BakeContext,
  image: CanvasImageSource,
  source: Size,
  crop: CropState,
  fill: BackdropFill,
  edge: number,
): void {
  if (fill.kind === "solid") {
    context.fillStyle = fill.color;
    context.fillRect(0, 0, edge, edge);
  } else if (fill.kind === "gradient") {
    const gradient = context.createLinearGradient(0, 0, 0, edge);
    gradient.addColorStop(0, fill.from);
    gradient.addColorStop(1, fill.to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, edge, edge);
  }
  const placement = placementFor(crop, source, edge);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.save();
  context.translate(placement.centerX, placement.centerY);
  context.scale(placement.scaleX, 1);
  context.rotate((placement.rotationDeg * Math.PI) / 180);
  context.drawImage(
    image,
    -placement.drawWidth / 2,
    -placement.drawHeight / 2,
    placement.drawWidth,
    placement.drawHeight,
  );
  context.restore();
}

export async function bakePicture(
  image: CanvasImageSource,
  source: Size,
  crop: CropState,
  fill: BackdropFill,
  edge: number,
  deps: BakeDeps,
): Promise<BakedPicture> {
  const canvas = deps.createCanvas(edge);
  canvas.width = edge;
  canvas.height = edge;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not draw the picture.");
  paintPicture(context, image, source, crop, fill, edge);
  const { blob, mime } = await encodePicture(canvas);
  return { blob, mime, fileName: mime === "image/webp" ? "token.webp" : "token.png", edge };
}

export const browserBakeDeps: BakeDeps = {
  createCanvas: () => document.createElement("canvas") as unknown as BakeCanvas,
};
