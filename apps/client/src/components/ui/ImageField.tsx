// ============================================================================
// IMAGE FIELD — the one way an image gets into HeroByte (S3)
// ============================================================================
// Upload from your own disk (or a phone's camera roll) as the DEFAULT, with a
// URL field as the permanent escape valve — for art already online, and for
// when a table's quota is full. Replaces five hand-rolled copies of the URL
// input that differed in commit semantics, styling, and (mostly absent) error
// reporting. The accept list names the four formats the server sniffs for;
// listing them explicitly (not image/*) is also what makes iOS transcode HEIC
// camera-roll photos to JPEG instead of handing us a file the server rejects.

import { useEffect, useId, useRef, useState } from "react";
import { JRPGButton } from "./JRPGPanel";
import {
  AssetUploadError,
  uploadAssetFile,
  uploadedAssetUrl,
  type AssetUploadCredentials,
} from "../../features/map-studio/uploads/assetUpload";
import { sessionCredentials } from "../../features/session/sessionBridge";
import { useImageUrlNormalization } from "../../hooks/useImageUrlNormalization";

export interface ImageFieldProps {
  /** Visible label, associated with the URL input (screen readers and tests). */
  label: string;
  /** The URL input buffer — controlled by the call site, like today. */
  value: string;
  onChange: (value: string) => void;
  /**
   * One commit path for every route in: Apply/Enter (and blur, if enabled)
   * commit the normalized URL text; a successful upload commits the stored
   * asset's absolute URL. Call sites decide what an empty commit means —
   * several treat it as "clear".
   */
  onCommit: (url: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Commit when the input loses focus (the DM editors' long-standing
   * behavior). Off for surfaces that want an explicit button press. */
  commitOnBlur?: boolean;
  /** Renders a Clear button when supplied. */
  onClear?: () => void;
  applyLabel?: string;
  /** Disable Apply while the input is empty — for surfaces where an empty
   * commit is meaningless (map background) rather than "clear". */
  applyRequiresValue?: boolean;
  /**
   * Dense one-row layout for crowded editors: the upload control becomes a
   * square button beside the URL input and the Apply/Clear row is dropped
   * (blur/Enter still commit — the semantics those editors always had).
   * The default spacious layout keeps the 44px full-width upload button for
   * finger-first surfaces.
   */
  compact?: boolean;
  /** Test seams; production uses the real pipeline + session credentials. */
  uploadFile?: typeof uploadAssetFile;
  getCredentials?: () => AssetUploadCredentials | null;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px",
  background: "#111",
  color: "var(--jrpg-white)",
  border: "1px solid var(--jrpg-border-gold)",
};

export function ImageField({
  label,
  value,
  onChange,
  onCommit,
  placeholder,
  disabled = false,
  commitOnBlur = true,
  onClear,
  applyLabel = "Apply",
  applyRequiresValue = false,
  compact = false,
  uploadFile = uploadAssetFile,
  getCredentials = sessionCredentials,
}: ImageFieldProps): JSX.Element {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { normalizeUrl, isNormalizing, normalizationError } = useImageUrlNormalization();

  // Commit through the LATEST render's callbacks, never the ones captured
  // when the async work started. An NPC editor's onCommit closes over every
  // sibling field (it sends the full record); replaying the closure from
  // file-pick time silently reverted edits made during a slow upload
  // (adversarial review finding).
  const commitRef = useRef({ onChange, onCommit });
  useEffect(() => {
    commitRef.current = { onChange, onCommit };
  });

  const busy = disabled || uploading || isNormalizing;

  const commitUrlText = async () => {
    setUploadError(null);
    const normalized = await normalizeUrl(value.trim());
    commitRef.current.onChange(normalized);
    commitRef.current.onCommit(normalized);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const info = await uploadFile(file, getCredentials());
      const url = uploadedAssetUrl(info.hash);
      commitRef.current.onChange(url);
      commitRef.current.onCommit(url);
    } catch (error) {
      setUploadError(
        error instanceof AssetUploadError ? error.message : "Upload failed — try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const errorText = uploadError ?? normalizationError;

  const uploadButton = compact ? (
    <JRPGButton
      onClick={() => fileRef.current?.click()}
      disabled={busy}
      aria-label="Upload image"
      title="Upload image"
      style={{ fontSize: "12px", padding: "4px 8px", flexShrink: 0 }}
    >
      {uploading ? "…" : "⬆"}
    </JRPGButton>
  ) : (
    <JRPGButton
      onClick={() => fileRef.current?.click()}
      disabled={busy}
      style={{ fontSize: "10px", padding: "8px", minHeight: "44px" }}
    >
      {uploading ? "Uploading…" : "⬆ Upload image"}
    </JRPGButton>
  );

  const urlInput = (
    <input
      id={inputId}
      className="jrpg-input"
      type="text"
      value={value}
      placeholder={placeholder ?? "Paste an image URL"}
      disabled={busy}
      style={inputStyle}
      onChange={(event) => onChange(event.target.value)}
      onBlur={commitOnBlur ? () => void commitUrlText() : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter") void commitUrlText();
      }}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? "4px" : "6px" }}>
      <label className="jrpg-text-small" htmlFor={inputId} style={{ color: "var(--jrpg-gold)" }}>
        {label}
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label={`${label} upload`}
        style={{ display: "none" }}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          // Reset so re-picking the same file re-fires change.
          event.target.value = "";
        }}
      />
      {compact ? (
        <div style={{ display: "flex", gap: "4px", alignItems: "stretch" }}>
          {urlInput}
          {uploadButton}
        </div>
      ) : (
        <>
          {uploadButton}
          {urlInput}
          <div style={{ display: "flex", gap: "6px" }}>
            <JRPGButton
              onClick={() => void commitUrlText()}
              disabled={busy || (applyRequiresValue && !value.trim())}
              variant="primary"
              style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
            >
              {isNormalizing ? "Converting…" : applyLabel}
            </JRPGButton>
            {onClear && (
              <JRPGButton
                onClick={onClear}
                disabled={busy}
                style={{ flex: 1, fontSize: "10px", padding: "6px 8px" }}
              >
                Clear
              </JRPGButton>
            )}
          </div>
        </>
      )}
      {errorText && (
        <p
          className="jrpg-text-small"
          role="alert"
          style={{ color: "var(--jrpg-danger, #ff6b6b)", margin: 0 }}
        >
          {errorText}
        </p>
      )}
    </div>
  );
}
