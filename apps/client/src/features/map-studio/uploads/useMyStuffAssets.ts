import { useCallback, useState } from "react";
import type { UploadedAssetInfo } from "./assetUpload";
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

  const removeAsset = useCallback((hash: string) => {
    setAssets((current) => removeMyStuffAsset(current, hash));
  }, []);

  return { assets, busy, error, uploadFiles, removeAsset };
}

function displayName(fileName: string): string {
  const trimmed = fileName.replace(/\.[a-z0-9]+$/i, "").trim();
  return (trimmed || "Untitled image").slice(0, MAX_NAME_LENGTH);
}

/** Natural dimensions inform the default grid footprint; failure is fine. */
function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof URL.createObjectURL !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}
