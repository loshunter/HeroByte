// ============================================================================
// CUSTOM TOKEN IMAGES
// ============================================================================
// What happens to a custom token's picture between "the DM chose it" and "the
// shelf holds it". Today: an 84px thumbnail, so the picker's grid draws one
// per cell instead of decoding the full picture — a phone photo is 4000px on
// its long side, and thirty of those in a scrolling grid is the whole reason
// the pack ships three rendered tiers of its own.
//
// Pure and dependency-injected, because jsdom has neither a 2D canvas nor
// image decoding: `browserPrepareDeps` below is the real Image/canvas/upload
// road and is proved in e2e, while every RULE here is proved in unit tests
// with fake deps — including each way a step is allowed to fail. Nothing in
// here ever rejects: a picture that cannot be read is still a usable token,
// it just keeps the link it came with.

import {
  AssetUploadError,
  uploadAssetFile,
  uploadedAssetUrl,
  uploadHashFromUrl,
  type AssetUploadCredentials,
} from "../../map-studio/uploads/assetUpload";
import { LIBRARY_TOKEN_ROOT } from "./tokenCatalog";

/** One pixel per pixel-15 cell, the size the pack renders its own thumbs at. */
export const CUSTOM_THUMB_SIDE = 84;

export interface PreparedCustomImage {
  /** What the token stores as its picture. */
  imageUrl: string;
  /** The 84px render's asset URL; absent when one could not be made. */
  thumbUrl?: string;
  /** One line for the form: why a step was skipped. */
  note?: string;
}

export interface PrepareDeps {
  loadImage(url: string): Promise<HTMLImageElement>;
  toPngBlob(image: HTMLImageElement, maxSide: number): Promise<Blob>;
  upload(blob: Blob, name: string): Promise<{ url: string }>;
}

/** Where a picture came from, which is what decides how much work it needs. */
export type CustomImageKind = "pack" | "ours" | "external";

/** The path half of a URL, in either shape a token's image is written in. */
function pathOf(url: string): string {
  if (url.startsWith("/")) return url;
  return /^https?:\/\/[^/]+(\/[^?#]*)/.exec(url)?.[1] ?? "";
}

/**
 * Pack art already HAS three rendered tiers under /tokens — rendering a fourth
 * and storing it in the table's asset quota would be pure waste. An upload is
 * already ours, at whatever origin this table is served from (uploadHashFromUrl
 * deliberately ignores the origin). Everything else is somebody else's link.
 */
export function classifyCustomImage(url: string): CustomImageKind {
  const trimmed = url.trim();
  if (pathOf(trimmed).startsWith(`${LIBRARY_TOKEN_ROOT}/`)) return "pack";
  if (trimmed.startsWith("/") || uploadHashFromUrl(trimmed)) return "ours";
  return "external";
}

const UNREADABLE =
  "No thumbnail — that image could not be read. It still works as the token's picture.";

/** Why a step was skipped, in the DM's words rather than the uploader's code. */
function whyNoThumb(error: unknown): string {
  return error instanceof AssetUploadError ? `No thumbnail — ${error.message}` : UNREADABLE;
}

/**
 * Give a custom token's picture an 84px thumbnail, if one can be made.
 *
 * One `loadImage` per add, whatever the picture needs afterwards. Every step
 * degrades rather than throws: a thumb that cannot be rendered (a tainted
 * canvas — media.discordapp.net sends no CORS header, so the load itself
 * fails) or cannot be stored (the table's quota is full) simply leaves
 * `thumbUrl` absent, and the picker falls back to the full picture exactly as
 * it did before this existed.
 */
export async function prepareCustomImage(
  imageUrl: string,
  deps: PrepareDeps,
): Promise<PreparedCustomImage> {
  const url = imageUrl.trim();
  if (!url || classifyCustomImage(url) === "pack") return { imageUrl: url };

  let image: HTMLImageElement;
  try {
    image = await deps.loadImage(url);
  } catch {
    return { imageUrl: url, note: UNREADABLE };
  }

  try {
    const blob = await deps.toPngBlob(image, CUSTOM_THUMB_SIDE);
    const { url: thumbUrl } = await deps.upload(blob, "token-thumb.png");
    return { imageUrl: url, thumbUrl };
  } catch (error) {
    return { imageUrl: url, note: whyNoThumb(error) };
  }
}

// ----------------------------------------------------------------------------
// The real road
// ----------------------------------------------------------------------------

/**
 * `crossOrigin = "anonymous"` is what makes the canvas readable afterwards.
 * A host that sends no `Access-Control-Allow-Origin` (media.discordapp.net)
 * fails the LOAD outright rather than tainting the canvas — same outcome for
 * us, one step earlier, and the reason the load has its own catch above.
 * `fetch` is not an option: the site's connect-src does not list i.imgur.com.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

/**
 * Contain inside a maxSide box, never upscaling — a 40px sprite stays 40px
 * rather than becoming a blurred 84px one. Smoothing is ON: these are
 * photographs and painted art, not the pack's pixel-15 sprites, which have
 * their own renders and never reach here.
 */
async function toPngBlob(image: HTMLImageElement, maxSide: number): Promise<Blob> {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("image has no dimensions");
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => {
    // Throws SecurityError synchronously on a tainted canvas; inside the
    // executor that is a rejection, which is the degrade path we want.
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("could not encode PNG"))),
      "image/png",
    );
  });
}

/** The same upload road ImageField uses, with the same session credentials. */
export function browserPrepareDeps(
  getCredentials: () => AssetUploadCredentials | null,
): PrepareDeps {
  return {
    loadImage,
    toPngBlob,
    upload: async (blob, name) => {
      const file = new File([blob], name, { type: "image/png" });
      const info = await uploadAssetFile(file, getCredentials());
      return { url: uploadedAssetUrl(info.hash) };
    },
  };
}
