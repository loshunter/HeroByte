// ============================================================================
// SESSION ASSETS — carrying uploaded image BYTES in and out of a session file
// ============================================================================
// A session file that names `upload:<hash>` without carrying the bytes is only
// restorable on a server that still holds the same asset store. On the deployed
// ephemeral filesystem that store dies after 15 minutes idle (DEPLOYMENT.md), so
// the reference round-trips perfectly and resolves to a broken image — a save
// that reports success and silently loses the DM's art.
//
// This runs ENTIRELY CLIENT-SIDE, on purpose. Both endpoints already exist and
// are tested: GET /assets/:hash is public, POST /assets is credential-gated. The
// WS layer has no access to AssetService at all, and every message handler is
// synchronous — so doing it server-side would mean threading the service through
// the container and introducing the first async handler. There is no need.
//
// The store is CONTENT-ADDRESSED, which is what makes this work: re-uploading
// the same bytes yields the same sha256, so every `upload:<hash>` reference in
// the restored session stays valid without rewriting a single one. assetUpload.ts
// says as much — "a map travels between servers and the reference stays valid
// after re-hosting". This is the piece that lets it.
//
// WHY A GENERIC SCAN rather than walking known fields: upload references live in
// token.imageUrl, prop.imageUrl, character.portrait, character.tokenImage,
// player.portrait, element data.assetId, terrain cell assetIds, and
// mapBackground — and that list grows. Enumerating them is the same whitelist
// mistake that made loadSession silently drop the whole map. Scanning the
// serialized bundle cannot miss a site, present or future.

import type { SessionAsset, SessionFile } from "@herobyte/shared";
import {
  httpBaseFromWsUrl,
  uploadAssetFile,
  type AssetUploadCredentials,
} from "../map-studio/uploads/assetUpload";
import { WS_URL } from "../../config";

/** Matches both reference shapes the app mints for a stored asset. */
const ASSET_REF = /(?:upload:|\/assets\/)([a-f0-9]{64})/g;

/**
 * Total inlined bytes we will put in one file. A DM with a big Shelf could
 * otherwise mint a download of hundreds of MB — base64 inflates by ~33% on top.
 * Exceeding it is REPORTED, never silently truncated.
 */
export const MAX_SESSION_ASSET_BYTES = 64 * 1024 * 1024;

export interface CollectedAssets {
  assets: SessionAsset[];
  /** Hashes that exist but were left out — over budget, or unreadable. */
  skipped: string[];
}

/** Every distinct asset hash referenced anywhere in the bundle. */
export function collectAssetHashes(file: SessionFile): string[] {
  const hashes = new Set<string>();
  // The assets array itself is excluded — it holds the bytes, not references,
  // and a base64 blob can contain 64 hex chars by chance.
  const { assets: _assets, ...referencing } = file;
  for (const match of JSON.stringify(referencing).matchAll(ASSET_REF)) {
    hashes.add(match[1]!);
  }
  return [...hashes];
}

/**
 * Fetch the bytes for each referenced asset so the file stands alone.
 *
 * A hash that 404s is SKIPPED, not fatal: its bytes are already gone from the
 * server, so failing the whole save would deny the DM the rest of their table
 * over art they have already lost.
 */
export async function collectSessionAssets(
  file: SessionFile,
  wsUrl: string = WS_URL,
): Promise<CollectedAssets> {
  const hashes = collectAssetHashes(file);
  const assets: SessionAsset[] = [];
  const skipped: string[] = [];
  let total = 0;

  for (const hash of hashes) {
    try {
      const response = await fetch(`${httpBaseFromWsUrl(wsUrl)}/assets/${hash}`);
      if (!response.ok) {
        skipped.push(hash);
        continue;
      }
      const buffer = await response.arrayBuffer();
      if (total + buffer.byteLength > MAX_SESSION_ASSET_BYTES) {
        skipped.push(hash);
        continue;
      }
      total += buffer.byteLength;
      assets.push({
        hash,
        mime: response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png",
        bytes: toBase64(new Uint8Array(buffer)),
      });
    } catch {
      skipped.push(hash);
    }
  }

  return { assets, skipped };
}

/**
 * Put inlined bytes back in the server's store, before the session that
 * references them lands. Content-addressing means the hashes come back
 * identical, so nothing in the restored session needs rewriting.
 *
 * Returns the hashes that could not be restored — the caller must say so rather
 * than let the DM find broken images later.
 */
export async function restoreSessionAssets(
  assets: SessionAsset[],
  credentials: AssetUploadCredentials | null,
  wsUrl: string = WS_URL,
): Promise<string[]> {
  const failed: string[] = [];
  for (const asset of assets) {
    try {
      const bytes = fromBase64(asset.bytes);
      // Reuse the real upload path: it is credential-gated, MIME-sniffed,
      // capped and quota-checked server-side. A session file is DM-supplied
      // input like any other, and must not get a private door.
      const file = new File([bytes as BlobPart], `${asset.hash}.bin`, { type: asset.mime });
      const info = await uploadAssetFile(file, credentials, wsUrl);
      // Content-addressing is the whole contract. If the hash came back
      // different the bytes changed in transit and every reference is now
      // dangling — report it rather than pretend the restore worked.
      if (info.hash !== asset.hash) failed.push(asset.hash);
    } catch {
      failed.push(asset.hash);
    }
  }
  return failed;
}

/** Chunked so a multi-MB image cannot blow the argument limit on spread. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
