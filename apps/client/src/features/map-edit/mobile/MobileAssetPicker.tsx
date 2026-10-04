import { useState } from "react";
import { ImageField } from "../../../components/ui/ImageField";
import { ObjectCollectionBrowser, useObjectCollection } from "../ObjectCollectionBrowser";
import type { UploadedAssetInfo } from "../../map-studio/uploads/assetUpload";

interface MobileAssetPickerProps {
  label: string;
  selected: string;
  onSelect: (assetId: string) => void;
  uploadAsset: (file: File) => Promise<UploadedAssetInfo>;
}

/** Share light collection presentation, not the lazy desktop toolbar or its upload UI. */
export function MobileAssetPicker({
  label,
  selected,
  onSelect,
  uploadAsset,
}: MobileAssetPickerProps) {
  const collection = useObjectCollection(selected, uploadAsset);
  const [urlBuffer, setUrlBuffer] = useState("");
  const { myStuff, category } = collection;
  return (
    <div className="mobile-tool-sheet__section">
      <span className="mobile-tool-sheet__label">{label}</span>
      <ObjectCollectionBrowser collection={collection} onSelect={onSelect}>
        {category === "my-stuff" && (
          <>
            <ImageField
              label="Upload art"
              value={urlBuffer}
              onChange={setUrlBuffer}
              onCommit={(url) => {
                if (!url) return;
                void myStuff.shelveUploadedUrl(url).then((assetId) => {
                  if (assetId) {
                    setUrlBuffer("");
                    onSelect(assetId);
                  }
                });
              }}
              placeholder="Paste image URL"
              applyRequiresValue
            />
            {myStuff.error && (
              <p className="collection-note" role="alert">
                {myStuff.error}
              </p>
            )}
          </>
        )}
      </ObjectCollectionBrowser>
    </div>
  );
}
