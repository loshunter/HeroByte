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
  ownAssetOrigin,
  uploadHashFromUrl,
  type AssetUploadCredentials,
} from "../../map-studio/uploads/assetUpload";
import { isCustomTokenImageUrl } from "@herobyte/shared";
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

/**
 * Pack art already HAS three rendered tiers under /tokens — rendering a fourth
 * and storing it in the table's asset quota would be pure waste. An upload is
 * already ours, at whatever origin this table is served from (uploadHashFromUrl
 * deliberately ignores the origin, because the server's is not the client's on
 * any deployment). Everything else is somebody else's link.
 *
 * "pack" is ROOT-RELATIVE only. It used to read the path out of any absolute
 * URL, so `https://cdn.example.com/tokens/goblin.png` classified as bundled
 * art and got no thumbnail, no copy and no note — silently, on a third-party
 * host, which is the one case where durability is the whole point. The library
 * only ever writes the root-relative form, so nothing real is lost; an
 * absolute URL to our own /tokens/ now takes the external road and merely does
 * a little redundant work.
 */
export function classifyCustomImage(url: string): CustomImageKind {
  const trimmed = url.trim();
  if (trimmed.startsWith(`${LIBRARY_TOKEN_ROOT}/`)) return "pack";
  if (trimmed.startsWith("/") || uploadHashFromUrl(trimmed)) return "ours";
  return "external";
}

/**
 * Whether "Keep a copy on this table" is on offer for an address — the SAME
 * predicate the pipeline uses, so the box cannot promise work the pipeline
 * then skips. It lives here, next to `classifyCustomImage`, because the form
 * had a second gate of its own that agreed with this one on the e2e rail and
 * disagreed in production: `/^https:\/\//` admitted `uploadedAssetUrl`'s
 * `https://herobyte-server.onrender.com/assets/<hash>`, so the box appeared,
 * ticked, after every ⬆ UPLOAD and did nothing.
 *
 * The URL test is the other half. An empty field, a bare `cat.png`, a
 * plain-http host and a `data:` URI are all "external" to the classifier, so
 * the box was offered — ticked — over four addresses the add refuses before
 * a copy is ever attempted.
 */
export function canKeepCopy(value: string): boolean {
  const trimmed = value.trim();
  return (
    isCustomTokenImageUrl(trimmed, ownAssetOrigin()) && classifyCustomImage(trimmed) === "external"
  );
}

/**
 * Deliberately says what the CLIENT can back. It used to end "The token still
 * works.", which is false whenever the address is one the server refuses — a
 * bare `cat.png`, a plain-http host — and that refusal is silent, so the DM
 * read a promise about a token that had just been thrown away.
 *
 * Two of them, because the reason differs and the DM's next move differs with
 * it. The cross-origin clause is true of somebody else's host and false of
 * this table's own upload, where a failed load means the bytes are gone or
 * the server is unreachable — and pointing a DM at imgur's CORS policy over a
 * file they uploaded here sends them to look in the wrong place entirely.
 */
const UNREADABLE = {
  external:
    "That image could not be read, so the token keeps the link you gave it — some hosts do not let another site copy their pictures.",
  ours: "That image could not be read, so the token keeps the address you gave it — check that the upload is still on this table.",
} as const;

/**
 * Why a step was skipped, in the DM's words rather than the uploader's code.
 *
 * A COLON, not a dash: several AssetUploadError messages contain a dash of
 * their own ("Upload failed — is the game server reachable?"), and chaining
 * two of them read as one run-on line at the table.
 *
 * The size line is REWRITTEN rather than passed through. "That image is over
 * the 5MB upload limit" was written for a file the DM chose, and here the
 * bytes are ours: a re-encode of their picture at up to 1254px. A 900KB JPEG
 * can land as a 3-4MB PNG, so the DM can be told their image is too large
 * when it is a third of the limit — and the thing they would do about it
 * (pick a smaller file) is not the thing that happened.
 */
function why(step: string, error: unknown): string {
  if (!(error instanceof AssetUploadError)) return `${step}: that image could not be copied.`;
  const detail =
    error.code === "too-large"
      ? "the copy HeroByte rendered came out over the 5MB upload limit."
      : error.message;
  return `${step}: ${detail}`;
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
    return { imageUrl: url, mirrored: false, note: UNREADABLE[kind] };
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
    // BOTH lines when both steps fail. `??=` kept only the copy's, so a DM
    // whose quota refused everything was told the link stays and never told
    // the picker would decode the full master in every cell from now on.
    const thumbNote = why("No thumbnail", error);
    note = note ? `${note} ${thumbNote}` : thumbNote;
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
