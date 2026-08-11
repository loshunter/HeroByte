// ============================================================================
// PLAYER PROP FORM
// ============================================================================
// The create half of the player props panel: name it, upload or paste an
// image, pick a size, choose how many, add. The ×N control mirrors the DM's
// bulk NPC add — string state so the field can sit empty mid-edit, clamped
// against PROP_CREATE_LIMITS, reconciled on blur, with the BUTTON label as
// the honest statement of what the press will do.

import { useState } from "react";
import type { TokenSize } from "@herobyte/shared";
import { PROP_CREATE_LIMITS } from "@herobyte/shared";
import { JRPGPanel, JRPGButton } from "../../components/ui/JRPGPanel";
import { ImageField } from "../../components/ui/ImageField";
import type { CreatePlayerPropInput } from "./usePlayerProps";

interface PlayerPropFormProps {
  onCreate: (input: CreatePlayerPropInput) => void;
  isCreating: boolean;
  creationError: string | null;
}

export function PlayerPropForm({ onCreate, isCreating, creationError }: PlayerPropFormProps) {
  const [label, setLabel] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [size, setSize] = useState<TokenSize>("medium");
  const [countInput, setCountInput] = useState("1");

  const parsedCount = Number.parseInt(countInput, 10);
  const count = Number.isFinite(parsedCount)
    ? Math.min(Math.max(parsedCount, PROP_CREATE_LIMITS.COUNT_MIN), PROP_CREATE_LIMITS.COUNT_MAX)
    : PROP_CREATE_LIMITS.COUNT_MIN;

  const handleCreate = () => {
    onCreate({
      label: label.trim().length > 0 ? label.trim() : "Prop",
      imageUrl: imageUrl.trim(),
      size,
      count,
    });
  };

  return (
    <JRPGPanel
      variant="simple"
      title="Add a Prop"
      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
    >
      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Label
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Treasure Chest"
          disabled={isCreating}
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
      </label>

      <ImageField
        label="Image"
        value={imageUrl}
        onChange={setImageUrl}
        onCommit={setImageUrl}
        disabled={isCreating}
        compact
      />

      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <label
          className="jrpg-text-small"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            flex: 1,
            minWidth: "90px",
          }}
        >
          Size
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as TokenSize)}
            disabled={isCreating}
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

        <label
          className="jrpg-text-small"
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          <span aria-hidden="true">×</span>
          <input
            type="number"
            min={PROP_CREATE_LIMITS.COUNT_MIN}
            max={PROP_CREATE_LIMITS.COUNT_MAX}
            step={1}
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            onBlur={() => setCountInput(String(count))}
            aria-label="How many props to add"
            disabled={isCreating}
            style={{ width: "44px", fontSize: "10px", padding: "4px" }}
          />
        </label>

        <JRPGButton
          variant="success"
          onClick={handleCreate}
          disabled={isCreating}
          style={{ fontSize: "10px", padding: "6px 12px" }}
          title={
            count > 1
              ? `Scatter ${count} copies around the centre of your view`
              : "Place one prop at the centre of your view"
          }
        >
          {isCreating ? "Adding..." : count > 1 ? `+ Scatter ${count}` : "+ Add Prop"}
        </JRPGButton>
      </div>

      {creationError && (
        <div
          style={{
            padding: "6px 8px",
            border: "1px solid var(--jrpg-red)",
            borderRadius: "4px",
            background: "rgba(214, 60, 83, 0.1)",
            color: "var(--jrpg-red)",
            fontFamily: "var(--font-body)",
            fontSize: "11px",
            lineHeight: 1.45,
          }}
        >
          {creationError}
        </div>
      )}
    </JRPGPanel>
  );
}
