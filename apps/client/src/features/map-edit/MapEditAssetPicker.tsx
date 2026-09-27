import { useRef } from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { ObjectCollectionBrowser, useObjectCollection } from "./ObjectCollectionBrowser";
import type { UploadedAssetInfo } from "../map-studio/uploads/assetUpload";

interface MapEditAssetPickerProps {
  selectedAssetId: string;
  onSelectAsset: (assetId: string) => void;
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>;
}

export function MapEditAssetPicker({
  selectedAssetId,
  onSelectAsset,
  uploadAsset,
}: MapEditAssetPickerProps) {
  const collection = useObjectCollection(selectedAssetId, uploadAsset);
  const fileRef = useRef<HTMLInputElement>(null);
  const { myStuff, category } = collection;
  return (
    <ObjectCollectionBrowser collection={collection} onSelect={onSelectAsset}>
      {category === "my-stuff" && (
        <>
          <JRPGButton
            onClick={() => fileRef.current?.click()}
            disabled={myStuff.busy}
            style={{ minHeight: 44, fontSize: 10 }}
          >
            {myStuff.busy ? "Uploading…" : "⬆ Upload image"}
          </JRPGButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            style={{ display: "none" }}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) void myStuff.uploadFiles(files);
              event.target.value = "";
            }}
          />
          {myStuff.error && (
            <p className="collection-note" role="alert">
              {myStuff.error}
            </p>
          )}
        </>
      )}
    </ObjectCollectionBrowser>
  );
}
