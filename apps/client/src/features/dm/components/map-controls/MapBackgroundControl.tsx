// ============================================================================
// MAP BACKGROUND CONTROL
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 3: Simple Map Controls.
// Provides interface for setting map background image URL with preview.

import { useState, useEffect } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";

export interface MapBackgroundControlProps {
  mapBackground: string | undefined;
  onSetMapBackground: (url: string) => void;
}

export function MapBackgroundControl({
  mapBackground,
  onSetMapBackground,
}: MapBackgroundControlProps) {
  const [mapUrl, setMapUrl] = useState(mapBackground ?? "");

  useEffect(() => {
    setMapUrl(mapBackground ?? "");
  }, [mapBackground]);

  const handleMapApply = () => {
    if (!mapUrl.trim()) return;
    onSetMapBackground(mapUrl.trim());
  };

  return (
    <JRPGPanel variant="simple" title="Map Background">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input
          type="text"
          value={mapUrl}
          placeholder="Paste image URL"
          onChange={(event) => setMapUrl(event.target.value)}
          style={{
            width: "100%",
            padding: "6px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
        <JRPGButton
          onClick={handleMapApply}
          variant="success"
          disabled={!mapUrl.trim()}
          style={{ fontSize: "10px" }}
        >
          Apply Background
        </JRPGButton>
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
