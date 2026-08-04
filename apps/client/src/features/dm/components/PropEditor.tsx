// ============================================================================
// PROP EDITOR COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 2: Entity Editors refactoring.
// Provides editing interface for prop properties including label, image, ownership, and size.

import { useState, useEffect } from "react";
import type { Prop, Player, TokenSize } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { ImageField } from "../../../components/ui/ImageField";

interface PropEditorProps {
  prop: Prop;
  players: Player[];
  onUpdate: (updates: {
    label: string;
    imageUrl: string;
    owner: string | null;
    size: TokenSize;
  }) => void;
  onDelete: () => void;
  isDeleting?: boolean;
  deletionError?: string | null;
  isUpdating?: boolean;
  updateError?: string | null;
}

export function PropEditor({
  prop,
  players,
  onUpdate,
  onDelete,
  isDeleting = false,
  deletionError = null,
  isUpdating = false,
  updateError = null,
}: PropEditorProps) {
  const [label, setLabel] = useState(prop.label);
  const [imageUrl, setImageUrl] = useState(prop.imageUrl);
  const [owner, setOwner] = useState<string | null>(prop.owner);
  const [size, setSize] = useState<TokenSize>(prop.size);

  useEffect(() => {
    setLabel(prop.label);
    setImageUrl(prop.imageUrl);
    setOwner(prop.owner);
    setSize(prop.size);
  }, [prop]);

  const commitUpdate = (
    overrides?: Partial<{
      label: string;
      imageUrl: string;
      owner: string | null;
      size: TokenSize;
    }>,
  ) => {
    const nextLabel = (overrides?.label ?? label).trim();
    const nextImageUrl = (overrides?.imageUrl ?? imageUrl).trim();
    const nextOwner = overrides?.owner !== undefined ? overrides.owner : owner;
    const nextSize = overrides?.size ?? size;

    onUpdate({
      label: nextLabel.length > 0 ? nextLabel : "Prop",
      imageUrl: nextImageUrl,
      owner: nextOwner,
      size: nextSize,
    });
  };

  const handleLabelBlur = () => commitUpdate({ label });
  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const newOwner = value === "null" ? null : value === "*" ? "*" : value;
    setOwner(newOwner);
    commitUpdate({ owner: newOwner });
  };
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = e.target.value as TokenSize;
    setSize(newSize);
    commitUpdate({ size: newSize });
  };

  return (
    <JRPGPanel variant="simple" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {updateError && (
        <div
          style={{
            padding: "8px",
            background: "rgba(232, 154, 156, 0.12)",
            border: "1px solid var(--jrpg-red)",
            borderRadius: "4px",
            color: "var(--jrpg-red)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.45,
            fontSize: "12px",
          }}
        >
          {updateError}
        </div>
      )}
      {isUpdating && (
        <div
          style={{
            padding: "6px",
            background: "rgba(218, 165, 32, 0.1)",
            border: "1px solid var(--jrpg-border-gold)",
            borderRadius: "4px",
            color: "var(--jrpg-gold)",
            fontSize: "11px",
            textAlign: "center",
          }}
        >
          Updating...
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
          Label
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLabelBlur();
            }}
            disabled={isUpdating}
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
              opacity: isUpdating ? 0.5 : 1,
              cursor: isUpdating ? "not-allowed" : "text",
            }}
          />
        </label>
      </div>

      <ImageField
        label="Image URL"
        value={imageUrl}
        onChange={setImageUrl}
        onCommit={(url) => {
          setImageUrl(url);
          commitUpdate({ imageUrl: url });
        }}
        disabled={isUpdating}
        compact
      />
      {imageUrl && (
        <img
          src={imageUrl}
          alt={`${prop.label} preview`}
          style={{
            width: "48px",
            height: "48px",
            objectFit: "cover",
            borderRadius: "4px",
            border: "1px solid var(--jrpg-border-gold)",
            alignSelf: "flex-start",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Ownership
        <select
          value={owner ?? "null"}
          onChange={handleOwnerChange}
          disabled={isUpdating}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
            opacity: isUpdating ? 0.5 : 1,
            cursor: isUpdating ? "not-allowed" : "pointer",
          }}
        >
          <option value="null">DM Only</option>
          <option value="*">Everyone</option>
          {players.map((player) => (
            <option key={player.uid} value={player.uid}>
              {player.name}
            </option>
          ))}
        </select>
      </label>

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Size
        <select
          value={size}
          onChange={handleSizeChange}
          disabled={isUpdating}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
            opacity: isUpdating ? 0.5 : 1,
            cursor: isUpdating ? "not-allowed" : "pointer",
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

      {deletionError && (
        <JRPGPanel
          variant="simple"
          style={{
            color: "var(--jrpg-red)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.45,
            fontSize: "11px",
            padding: "6px 8px",
            border: "1px solid var(--jrpg-red)",
            background: "rgba(214, 60, 83, 0.1)",
          }}
        >
          {deletionError}
        </JRPGPanel>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <JRPGButton
          variant="danger"
          onClick={() => {
            // Single-click delete with no undo — see NPCEditor for the same fix.
            if (window.confirm(`Delete "${prop.label}"? This cannot be undone.`)) {
              onDelete();
            }
          }}
          disabled={isDeleting || isUpdating}
          style={{ fontSize: "10px", flex: 1 }}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
}
