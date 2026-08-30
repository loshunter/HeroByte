import { useCallback, useState } from "react";
import {
  uploadAssetId,
  uploadHashFromUrl,
  uploadedAssetUrl,
  type UploadedAssetInfo,
} from "./assetUpload";
import {
  addMyStuffAsset,
  loadMyStuffAssets,
  removeMyStuffAsset,
  type MyStuffAsset,
} from "./myStuffStore";

const MAX_NAME_LENGTH = 40;

export interface MyStuffAssetsState {
  assets: MyStuffAsset[];
  busy: boolean;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<void>;
  /**
   * Shelve an image that something ELSE already uploaded, named by the URL it
   * committed — the phone's route, where ImageField owns the file input and the
   * upload and hands back only a URL. Returns the new asset id, or null when
   * the URL is not one of this table's own assets.
   */
  shelveUploadedUrl: (url: string) => Promise<string | null>;
  removeAsset: (hash: string) => void;
}

/**
 * The "My Stuff" shelf: uploads files through the controller and mirrors the
 * localStorage inventory into React state. Batch uploads continue past
 * individual failures; the last failure message is surfaced.
 */
export function useMyStuffAssets(
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>,
): MyStuffAssetsState {
  const [assets, setAssets] = useState<MyStuffAsset[]>(() => loadMyStuffAssets());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      setError(null);
      for (const file of files) {
        try {
          const info = await uploadAsset(file);
          const dimensions = await measureImage(file);
          const entry: MyStuffAsset = {
            hash: info.hash,
            name: displayName(file.name),
            mime: info.mime,
            size: info.size,
            ...(dimensions ?? {}),
            addedAt: Date.now(),
          };
          // Functional update: composes correctly across concurrent batches
          // and keeps React state (not a re-read of localStorage) as truth.
          setAssets((current) => addMyStuffAsset(current, entry));
        } catch (thrown) {
          setError(thrown instanceof Error ? thrown.message : "Upload failed.");
        }
      }
      setBusy(false);
    },
    [uploadAsset],
  );

  const shelveUploadedUrl = useCallback(async (url: string): Promise<string | null> => {
    const hash = uploadHashFromUrl(url);
    if (!hash) {
      setError("Upload an image, or paste a link to one already on this table.");
      return null;
    }
    setError(null);
    // Measured from the URL because this route never sees the File. Worth the
    // round trip (the bytes are cached from the upload): without it every
    // uploaded asset places at 1x1, since that is what getMapStudioTileAsset
    // synthesizes for an id with no local record.
    const dimensions = await measureImageSrc(uploadedAssetUrl(hash));
    const entry: MyStuffAsset = {
      hash,
      name: "Uploaded image",
      mime: "image/*",
      size: 0,
      ...(dimensions ?? {}),
      addedAt: Date.now(),
    };
    setAssets((current) => addMyStuffAsset(current, entry));
    return uploadAssetId(hash);
  }, []);

  const removeAsset = useCallback((hash: string) => {
    setAssets((current) => removeMyStuffAsset(current, hash));
  }, []);

  return { assets, busy, error, uploadFiles, shelveUploadedUrl, removeAsset };
}

function displayName(fileName: string): string {
  const trimmed = fileName.replace(/\.[a-z0-9]+$/i, "").trim();
  return (trimmed || "Untitled image").slice(0, MAX_NAME_LENGTH);
}

/** Natural dimensions inform the default grid footprint; failure is fine. */
function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof URL.createObjectURL !== "function") return Promise.resolve(null);
  const objectUrl = URL.createObjectURL(file);
  return measureImageSrc(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
}

/**
 * The same measurement for a source this browser can already fetch.
 *
 * BOUNDED, because this one is awaited on the path that arms what a DM just
 * uploaded. A request that neither loads nor errors — a stalled connection, or
 * any environment that does not fetch subresources — would otherwise leave the
 * promise pending forever and the upload would silently never arm. Timing out
 * costs only the measured footprint: the asset still shelves and still places,
 * at the 1x1 default.
 */
const MEASURE_TIMEOUT_MS = 5_000;

function measureImageSrc(src: string): Promise<{ width: number; height: number } | null> {
  if (typeof Image !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    const settle = (value: { width: number; height: number } | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    image.onload = () => settle({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => settle(null);
    image.src = src;
  });
}
