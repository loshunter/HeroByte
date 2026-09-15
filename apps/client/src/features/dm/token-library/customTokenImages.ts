// ============================================================================
// CUSTOM TOKEN IMAGES
// ============================================================================
// What happens to a custom token's picture between "the DM chose it" and "the
// shelf holds it". Two things:
//
//   1. An 84px thumbnail, so the picker's grid draws one per cell instead of
//      decoding the full picture — a phone photo is 4000px on its long side,
//      and thirty of those in a scrolling grid is the whole reason the pack
//      ships three rendered tiers of its own.
//   2. For a link, a COPY on this table, so the token outlives the host. An
//      imgur link is only as permanent as imgur, and a campaign that runs for
//      a year will outlast some of them.
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

/** The pack's master size: big enough for any table's zoom, and a known bound. */
export const CUSTOM_MIRROR_MAX_SIDE = 1254;

export interface PreparedCustomImage {
  /** What the token stores as its picture: the copy, or the original link. */
  imageUrl: string;
  /** The 84px render's asset URL; absent when one could not be made. */
  thumbUrl?: string;
  /** True when `imageUrl` is this table's copy rather than the link given. */
  mirrored: boolean;
  /** One line for the form: why a step was skipped. */
  note?: string;
}

export interface PrepareOptions {
  /** Keep a copy of an https link on this table. Ignored for anything else. */
  mirror: boolean;
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
  "That image could not be read, so the link is kept as it is — some hosts do not let another site copy their pictures. The token still works.";

/**
 * Why a step was skipped, in the DM's words rather than the uploader's code.
 *
 * A COLON, not a dash: several AssetUploadError messages contain a dash of
 * their own ("Upload failed — is the game server reachable?"), and chaining
 * two of them read as one run-on line at the table.
 */
function why(step: string, error: unknown): string {
  return error instanceof AssetUploadError
    ? `${step}: ${error.message}`
    : `${step}: that image could not be copied.`;
}

/**
 * Give a custom token's picture an 84px thumbnail, and — for a link the DM
 * asked to keep — a copy of the picture on this table.
 *
 * One `loadImage` per add, both renders from it. Every step degrades rather
 * than throws: a picture that cannot be rendered (a tainted canvas — or a
 * host like media.discordapp.net that sends no CORS header, where the load
 * itself fails) or cannot be stored (the table's quota is full) leaves the
 * link exactly as it was given, which is what the shelf always held. The DM
 * gets one line saying which step was skipped, and a working token either way.
 */
export async function prepareCustomImage(
  imageUrl: string,
  options: PrepareOptions,
  deps: PrepareDeps,
): Promise<PreparedCustomImage> {
  const url = imageUrl.trim();
  const kind = url ? classifyCustomImage(url) : "pack";
  if (kind === "pack") return { imageUrl: url, mirrored: false };

  let image: HTMLImageElement;
  try {
    image = await deps.loadImage(url);
  } catch {
    return { imageUrl: url, mirrored: false, note: UNREADABLE };
  }

  // The copy first: it is what the token's picture becomes, and a DM who
  // asked for permanence cares more about it than about the thumbnail.
  let copied: string | undefined;
  let note: string | undefined;
  if (kind === "external" && options.mirror) {
    try {
      const blob = await deps.toPngBlob(image, CUSTOM_MIRROR_MAX_SIDE);
      copied = (await deps.upload(blob, "token.png")).url;
    } catch (error) {
      note = why("No copy was made, so the link stays", error);
    }
  }

  let thumbUrl: string | undefined;
  try {
    const blob = await deps.toPngBlob(image, CUSTOM_THUMB_SIDE);
    thumbUrl = (await deps.upload(blob, "token-thumb.png")).url;
  } catch (error) {
    // The copy's failure is the bigger news, so it keeps the line.
    note ??= why("No thumbnail", error);
  }

  return {
    imageUrl: copied ?? url,
    ...(thumbUrl ? { thumbUrl } : {}),
    mirrored: copied !== undefined,
    ...(note ? { note } : {}),
  };
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
