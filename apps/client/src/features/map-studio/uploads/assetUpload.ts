// Client half of the content-addressed asset pipeline: ships image bytes to
// POST /assets and turns "upload:<hash>" asset ids back into servable URLs.
// The contract this mirrors is pinned by apps/server/src/http/routes.ts and
// its assetRoutes tests: raw-byte body, room secret header, sniffed MIME,
// 5MB per-asset cap, and a JSON body of { hash, url, mime, size, deduplicated }.
import { WS_URL } from "../../../config";

/** Documents reference uploads as `upload:<sha256>` — content-addressed, so a
 * map travels between servers and the reference stays valid after re-hosting. */
export const UPLOAD_ASSET_ID_PREFIX = "upload:";

/** Mirrors the server's per-asset cap so oversized files fail before the POST. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SHA256_HEX = /^[a-f0-9]{64}$/;
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/**
 * Clamp a server-declared content-type to the accepted image set, defaulting
 * to image/png. Used before composing a data: URI into SVG markup so a
 * surprising header can't ride along verbatim.
 */
export function clampImageMime(contentType: string | null): string {
  const declared = (contentType ?? "").split(";")[0]!.trim().toLowerCase();
  return ACCEPTED_MIME_TYPES.has(declared) ? declared : "image/png";
}

export type AssetUploadErrorCode =
  | "no-credentials"
  | "empty"
  | "unauthorized"
  | "too-large"
  | "unsupported-type"
  | "quota-exceeded"
  | "failed";

export class AssetUploadError extends Error {
  readonly code: AssetUploadErrorCode;

  constructor(code: AssetUploadErrorCode, message: string) {
    super(message);
    this.name = "AssetUploadError";
    this.code = code;
  }
}

export interface AssetUploadCredentials {
  secret: string;
  roomId?: string;
}

export interface UploadedAssetInfo {
  hash: string;
  url: string;
  mime: string;
  size: number;
  deduplicated: boolean;
}

export function httpBaseFromWsUrl(wsUrl: string): string {
  const parsed = new URL(wsUrl);
  const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
  return `${protocol}//${parsed.host}`;
}

export function uploadAssetId(hash: string): string {
  return `${UPLOAD_ASSET_ID_PREFIX}${hash}`;
}

export function uploadHashFromAssetId(assetId: string): string | null {
  if (!assetId.startsWith(UPLOAD_ASSET_ID_PREFIX)) return null;
  const hash = assetId.slice(UPLOAD_ASSET_ID_PREFIX.length);
  return SHA256_HEX.test(hash) ? hash : null;
}

export function uploadedAssetUrl(hash: string, wsUrl: string = WS_URL): string {
  return `${httpBaseFromWsUrl(wsUrl)}/assets/${hash}`;
}

const STATUS_ERRORS: Record<number, { code: AssetUploadErrorCode; message: string }> = {
  401: { code: "unauthorized", message: "The room credentials were rejected." },
  413: { code: "too-large", message: "That image is over the 5MB upload limit." },
  415: { code: "unsupported-type", message: "Only PNG, JPEG, GIF, and WebP images can upload." },
  507: { code: "quota-exceeded", message: "The room's asset storage is full." },
};

export async function uploadAssetFile(
  file: File,
  credentials: AssetUploadCredentials | null,
  wsUrl: string = WS_URL,
): Promise<UploadedAssetInfo> {
  if (!credentials?.secret) {
    throw new AssetUploadError("no-credentials", "Join the room before uploading assets.");
  }
  // The server rejects a zero-length body with a raw 411; catch it here so the
  // DM sees a real explanation instead of "Content-Length required".
  if (file.size === 0) {
    throw new AssetUploadError("empty", "That file is empty.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AssetUploadError("too-large", "That image is over the 5MB upload limit.");
  }
  // An empty type means the browser could not sniff; the server sniffs magic
  // bytes anyway, so only clearly-wrong declared types fail fast here.
  if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new AssetUploadError(
      "unsupported-type",
      "Only PNG, JPEG, GIF, and WebP images can upload.",
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "x-herobyte-secret": credentials.secret,
  };
  if (credentials.roomId) headers["x-herobyte-room"] = credentials.roomId;

  let bytes: ArrayBuffer;
  try {
    bytes = await fileBytes(file);
  } catch {
    throw new AssetUploadError("failed", "Could not read that file.");
  }

  let response: Response;
  try {
    response = await fetch(`${httpBaseFromWsUrl(wsUrl)}/assets`, {
      method: "POST",
      headers,
      body: bytes,
    });
  } catch {
    throw new AssetUploadError("failed", "Upload failed — is the game server reachable?");
  }

  if (!response.ok) {
    const known = STATUS_ERRORS[response.status];
    if (known) throw new AssetUploadError(known.code, known.message);
    throw new AssetUploadError("failed", await serverErrorMessage(response));
  }

  const body: unknown = await response.json().catch(() => null);
  const info = parseUploadedAssetInfo(body);
  if (!info) {
    throw new AssetUploadError("failed", "The server returned an unexpected upload response.");
  }
  return info;
}

/** Blob.arrayBuffer with a FileReader fallback for older engines (and jsdom). */
function fileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Unable to read the file"));
    reader.readAsArrayBuffer(file);
  });
}

async function serverErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return "Upload failed.";
}

function parseUploadedAssetInfo(body: unknown): UploadedAssetInfo | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.hash !== "string" || !SHA256_HEX.test(record.hash)) return null;
  if (typeof record.url !== "string" || typeof record.mime !== "string") return null;
  if (typeof record.size !== "number") return null;
  return {
    hash: record.hash,
    url: record.url,
    mime: record.mime,
    size: record.size,
    deduplicated: record.deduplicated === true,
  };
}
