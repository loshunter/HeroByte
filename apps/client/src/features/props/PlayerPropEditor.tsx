// ============================================================================
// PLAYER PROP EDITOR
// ============================================================================
// The per-prop editor a player sees for props THEY own: label, image, size,
// delete. Deliberately no Ownership control — the server refuses a player
// re-homing a prop, so offering the select would be a lie. The DM's full
// editor (features/dm/PropEditor) keeps it; this one stays out of the DM
// lazy chunk so players get it without elevation.

import { useState, useEffect } from "react";
import type { Prop, TokenSize } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import { ImageField } from "../../components/ui/ImageField";

interface PlayerPropEditorProps {
  prop: Prop;
  onUpdate: (updates: { label: string; imageUrl: string; size: TokenSize }) => void;
  onDelete: () => void;
}

export function PlayerPropEditor({ prop, onUpdate, onDelete }: PlayerPropEditorProps) {
  const [label, setLabel] = useState(prop.label);
  const [imageUrl, setImageUrl] = useState(prop.imageUrl);
  const [size, setSize] = useState<TokenSize>(prop.size);

  useEffect(() => {
    setLabel(prop.label);
    setImageUrl(prop.imageUrl);
    setSize(prop.size);
  }, [prop]);

  const commitUpdate = (
    overrides?: Partial<{ label: string; imageUrl: string; size: TokenSize }>,
  ) => {
    const nextLabel = (overrides?.label ?? label).trim();
    const nextImageUrl = (overrides?.imageUrl ?? imageUrl).trim();
    onUpdate({
      label: nextLabel.length > 0 ? nextLabel : "Prop",
      imageUrl: nextImageUrl,
      size: overrides?.size ?? size,
    });
  };

  return (
    <JRPGPanel variant="simple" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={`${prop.label} preview`}
            style={{
              width: "36px",
              height: "36px",
              objectFit: "cover",
              borderRadius: "4px",
              border: "1px solid var(--jrpg-border-gold)",
              flexShrink: 0,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => commitUpdate({ label })}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitUpdate({ label });
          }}
          aria-label="Prop label"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
      </div>

      <ImageField
        label="Image URL"
        value={imageUrl}
        onChange={setImageUrl}
        onCommit={(url) => {
          setImageUrl(url);
          commitUpdate({ imageUrl: url });
        }}
        compact
      />

      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <label
          className="jrpg-text-small"
          style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}
        >
          Size
          <select
            value={size}
            onChange={(e) => {
              const newSize = e.target.value as TokenSize;
              setSize(newSize);
              commitUpdate({ size: newSize });
            }}
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
            }}
          >
            <option value="tiny">Tiny</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="huge">Huge</option>
            <option value="gargantuan">Gargantuan</option>
          </select>
        </label>

        <JRPGButton
          variant="danger"
          onClick={() => {
            // Single-click delete with no undo — same confirm the DM editor uses.
            if (window.confirm(`Delete "${prop.label}"? This cannot be undone.`)) {
              onDelete();
            }
          }}
          style={{ fontSize: "10px", padding: "6px 12px" }}
        >
          Delete
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
}
