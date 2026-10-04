import type { MapDocument } from "@herobyte/shared";
import { JRPGButton } from "../../../../components/ui/JRPGPanel";
import { downloadMapDocument } from "../../../map-studio";

interface MapStudioExportControlsProps {
  document: MapDocument;
  disabled: boolean;
}

// Each file says what it holds before a DM picks it: a picture of the map, or
// the editable map itself. A whole-table backup is a third, different file
// that lives with the table's session controls.
const IMAGE_FORMATS = [
  { format: "png", label: "PNG" },
  { format: "webp", label: "WebP" },
  { format: "svg", label: "SVG" },
] as const;

export function MapStudioExportControls({ document, disabled }: MapStudioExportControlsProps) {
  return (
    <>
      <p className="jrpg-text-small" style={{ margin: "0 0 4px" }}>
        Export map image — a picture of this map, not editable:
      </p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
        {IMAGE_FORMATS.map(({ format, label }) => (
          <JRPGButton
            key={format}
            aria-label={`Export map image (${label})`}
            style={{ flex: 1, fontSize: "10px" }}
            disabled={disabled}
            onClick={() => downloadMapDocument(document, format)}
          >
            {label}
          </JRPGButton>
        ))}
      </div>
      <JRPGButton
        style={{ width: "100%", fontSize: "10px", marginBottom: "6px" }}
        disabled={disabled}
        onClick={() => downloadMapDocument(document, "json")}
      >
        Export editable map (.json)
      </JRPGButton>
    </>
  );
}
