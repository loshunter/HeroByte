// ============================================================================
// TOKEN CREATOR — WHERE A PICTURE COMES FROM
// ============================================================================
// Four ways in: a picked file, a dropped file (or a dropped link), a pasted
// image, a typed link. Files never taint the canvas (blob: is same-origin). A
// link loads through <img crossOrigin="anonymous">, never fetch (the CSP's
// connect-src does not list other hosts; img-src does); a host that sends no
// CORS header fails the load outright, and the creator then offers the link
// "as is", today's behaviour.

import { readableImageSource } from "../../dm/token-library/customTokenImages";
import { normalizeImageUrl } from "../../../utils/imageUrlHelpers";
import { AUTO_FALLBACK, AUTO_SAMPLE_EDGE, autoBackdropColor } from "./backdrop";
import type { Size } from "./cropMath";

/** The four formats the server sniffs for (GIF bakes to its first frame). */
export const PICTURE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const PICTURE_ACCEPT = PICTURE_TYPES.join(",");

export interface LoadedPicture {
  image: HTMLImageElement;
  size: Size;
  /** What the crop area's <img> shows (a blob: URL for files). */
  displaySrc: string;
  /** The link it came from; absent for a file. */
  link?: string;
  /** Revoke the blob URL, if any. */
  release: () => void;
}

/** A link that would not load readably: offer it as is. */
export class UnbakeableLinkError extends Error {
  constructor(readonly link: string) {
    super("That site does not let HeroByte copy its pictures.");
    this.name = "UnbakeableLinkError";
  }
}

interface FileList_ {
  readonly length: number;
  item(index: number): File | null;
}
interface ItemList_ {
  readonly length: number;
  [index: number]: { kind: string; type: string; getAsFile(): File | null } | undefined;
}
/** The parts of DataTransfer (drop) and clipboardData (paste) read here. */
export interface TransferLike {
  files?: FileList_ | null;
  items?: ItemList_ | null;
  getData?: (format: string) => string;
}

function accepted(file: File | null | undefined): file is File {
  return Boolean(file && (PICTURE_TYPES as readonly string[]).includes(file.type));
}

/** The first picture file in a drop or a paste, or null. */
export function pictureFileFrom(transfer: TransferLike | null | undefined): File | null {
  if (!transfer) return null;
  const files = transfer.files;
  if (files) {
    for (let i = 0; i < files.length; i += 1) {
      const file = files.item(i);
      if (accepted(file)) return file;
    }
  }
  // A pasted screenshot arrives as an item, often with an empty files list.
  const items = transfer.items;
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item?.kind !== "file") continue;
      const file = item.getAsFile();
      if (accepted(file)) return file;
    }
  }
  return null;
}

/** A dropped or pasted http(s) link, or null (an image dragged from a web page). */
export function pictureLinkFrom(transfer: TransferLike | null | undefined): string | null {
  const read = (format: string) => {
    try {
      return transfer?.getData?.(format) ?? "";
    } catch {
      return "";
    }
  };
  const candidates = [
    ...read("text/uri-list")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#")),
    read("text/plain"),
  ];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed;
  }
  return null;
}

export interface LoadDeps {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  loadImage: (src: string, crossOrigin: boolean) => Promise<HTMLImageElement>;
  readableSource: (url: string) => Promise<string>;
  normalizeLink: (url: string) => Promise<string>;
}

function sizeOf(image: HTMLImageElement): Size {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("That picture has no size.");
  return { width, height };
}

export async function loadPictureFile(file: File, deps: LoadDeps): Promise<LoadedPicture> {
  const url = deps.createObjectURL(file);
  try {
    const image = await deps.loadImage(url, false);
    return {
      image,
      size: sizeOf(image),
      displaySrc: url,
      release: () => deps.revokeObjectURL(url),
    };
  } catch (error) {
    deps.revokeObjectURL(url);
    throw error instanceof Error && error.message === "That picture has no size."
      ? error
      : new Error("That file could not be read as a picture.");
  }
}

export async function loadPictureLink(link: string, deps: LoadDeps): Promise<LoadedPicture> {
  const direct = await deps.normalizeLink(link.trim()).catch(() => link.trim());
  let source: string;
  try {
    source = await deps.readableSource(direct);
  } catch {
    throw new UnbakeableLinkError(direct);
  }
  const ownBlob = source !== direct;
  try {
    const image = await deps.loadImage(source, true);
    return {
      image,
      size: sizeOf(image),
      displaySrc: source,
      link: direct,
      release: () => {
        if (ownBlob) deps.revokeObjectURL(source);
      },
    };
  } catch {
    if (ownBlob) deps.revokeObjectURL(source);
    throw new UnbakeableLinkError(direct);
  }
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

export const browserLoadDeps: LoadDeps = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  loadImage,
  readableSource: (url) => readableImageSource(url),
  normalizeLink: (url) => normalizeImageUrl(url),
};

/** The auto backdrop colour, read from a small copy of the picture. */
export function sampleAutoColor(picture: LoadedPicture): string {
  try {
    const scale = AUTO_SAMPLE_EDGE / Math.max(picture.size.width, picture.size.height);
    const width = Math.max(1, Math.round(picture.size.width * scale));
    const height = Math.max(1, Math.round(picture.size.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return AUTO_FALLBACK;
    context.drawImage(picture.image, 0, 0, width, height);
    return autoBackdropColor(context.getImageData(0, 0, width, height).data, width, height);
  } catch {
    // jsdom has no canvas; a tainted one cannot be read. Neither is fatal.
    return AUTO_FALLBACK;
  }
}
