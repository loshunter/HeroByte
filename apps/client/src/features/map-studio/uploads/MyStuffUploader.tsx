import { useRef, useState, type DragEvent } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/webp";

interface MyStuffUploaderProps {
  busy: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
}

/** Drop target + file picker for the My Stuff palette category. */
export function MyStuffUploader({ busy, error, onFiles }: MyStuffUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pickFiles = (list: FileList | null) => {
    // Ignore new files while a batch is uploading: the shared busy/error state
    // can't cleanly represent two overlapping batches.
    if (busy) return;
    const files = Array.from(list ?? []);
    if (files.length) onFiles(files);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    pickFiles(event.dataTransfer?.files ?? null);
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        aria-label="Upload images to My Stuff"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "#7fd6ff" : "#8a7445"}`,
          background: dragOver ? "rgba(127,214,255,0.12)" : "transparent",
          display: "grid",
          gap: 6,
          placeItems: "center",
          padding: "10px 8px",
        }}
      >
        <span className="jrpg-text-small" style={{ textAlign: "center" }}>
          Drop an image here (PNG, JPEG, GIF, WebP · 5MB max)
        </span>
        <JRPGButton disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "UPLOADING…" : "UPLOAD IMAGE"}
        </JRPGButton>
      </div>
      {error && (
        <div role="alert" className="jrpg-text-small" style={{ color: "#e07070", marginTop: 6 }}>
          {error}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        aria-label="My Stuff image files"
        style={{ display: "none" }}
        onChange={(event) => {
          pickFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
