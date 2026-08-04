// ============================================================================
// MAP BACKGROUND CONTROL
// ============================================================================
// Sets the table's background image. The input surface is the shared
// ImageField (S3): upload from disk is the default, pasting a URL stays the
// escape valve. This control keeps its one extra behavior — pre-flighting
// that a pasted URL actually loads as an image before committing it to the
// whole table — plus the DM toast on success/failure.

import { useState, useEffect } from "react";
import { JRPGPanel } from "../../../../components/ui/JRPGPanel";
import { ImageField } from "../../../../components/ui/ImageField";
import { Spinner } from "../../../../components/ui/Spinner";

export interface MapBackgroundControlProps {
  mapBackground: string | undefined;
  onSetMapBackground: (url: string) => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function MapBackgroundControl({
  mapBackground,
  onSetMapBackground,
  onSuccess,
  onError,
}: MapBackgroundControlProps) {
  const [mapUrl, setMapUrl] = useState(mapBackground ?? "");
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    setMapUrl(mapBackground ?? "");
  }, [mapBackground]);

  const handleCommit = async (url: string) => {
    if (!url.trim()) return;

    setIsApplying(true);
    try {
      // Verify the image can be loaded before pushing it to the whole table.
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
      });

      onSetMapBackground(url);
      onSuccess?.("Map background updated successfully");
    } catch (error) {
      console.error("[MapBackgroundControl] Error applying map background:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load image";
      onError?.(errorMessage);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <JRPGPanel variant="simple" title="Map Background">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <ImageField
          label="Map Background URL"
          value={mapUrl}
          onChange={setMapUrl}
          onCommit={(url) => void handleCommit(url)}
          placeholder="Paste image URL"
          applyLabel="Apply Background"
          applyRequiresValue
          commitOnBlur={false}
          disabled={isApplying}
        />
        {isApplying && (
          <div
            className="jrpg-text-small"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Spinner size={12} color="var(--jrpg-white)" />
            <span>Loading image...</span>
          </div>
        )}
        {mapBackground && (
          <img
            src={mapBackground}
            alt="Current map background"
            style={{
              width: "100%",
              maxHeight: "120px",
              objectFit: "cover",
              borderRadius: "4px",
            }}
          />
        )}
      </div>
    </JRPGPanel>
  );
}
