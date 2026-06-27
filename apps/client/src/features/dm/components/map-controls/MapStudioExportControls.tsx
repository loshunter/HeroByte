import type { MapDocument } from "@herobyte/shared";
import { JRPGButton } from "../../../../components/ui/JRPGPanel";
import { downloadMapDocument } from "../../../map-studio";

interface MapStudioExportControlsProps {
  document: MapDocument;
  disabled: boolean;
}

export function MapStudioExportControls({ document, disabled }: MapStudioExportControlsProps) {
  return (
    <>
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
        <JRPGButton
          style={{ flex: 1, fontSize: "10px" }}
          disabled={disabled}
          onClick={() => downloadMapDocument(document, "svg")}
        >
          EXPORT SVG
        </JRPGButton>
        <JRPGButton
          style={{ flex: 1, fontSize: "10px" }}
          disabled={disabled}
          onClick={() => downloadMapDocument(document, "json")}
        >
          BACKUP JSON
        </JRPGButton>
      </div>
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
        <JRPGButton
          style={{ flex: 1, fontSize: "10px" }}
          disabled={disabled}
          onClick={() => downloadMapDocument(document, "png")}
        >
          EXPORT PNG
        </JRPGButton>
        <JRPGButton
          style={{ flex: 1, fontSize: "10px" }}
          disabled={disabled}
          onClick={() => downloadMapDocument(document, "webp")}
        >
          EXPORT WEBP
        </JRPGButton>
      </div>
    </>
  );
}
