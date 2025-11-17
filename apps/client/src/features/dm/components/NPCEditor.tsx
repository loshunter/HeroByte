// ============================================================================
// NPC EDITOR COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 2: Entity Editors refactoring.
// Provides editing interface for NPC properties including name, HP, and images.

import { useState, useEffect } from "react";
import type { Character } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useImageUrlNormalization } from "../../../hooks/useImageUrlNormalization";
import { StatusBanner } from "../../../components/ui/StatusBanner";

interface NPCEditorProps {
  npc: Character;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    portrait?: string;
    tokenImage?: string;
    initiativeModifier?: number;
  }) => void;
  onPlace: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  updateError?: string | null;
  isPlacingToken?: boolean;
  tokenPlacementError?: string | null;
}

export function NPCEditor({
  npc,
  onUpdate,
  onPlace,
  onDelete,
  isUpdating = false,
  updateError = null,
  isPlacingToken = false,
  tokenPlacementError = null,
}: NPCEditorProps) {
  const [name, setName] = useState(npc.name);
  const [hpInput, setHpInput] = useState(String(npc.hp));
  const [maxHpInput, setMaxHpInput] = useState(String(npc.maxHp));
  const [initiativeModifierInput, setInitiativeModifierInput] = useState(
    String(npc.initiativeModifier ?? 0),
  );
  const [portrait, setPortrait] = useState(npc.portrait ?? "");
  const [tokenImage, setTokenImage] = useState(npc.tokenImage ?? "");
  const { normalizeUrl } = useImageUrlNormalization();

  useEffect(() => {
    setName(npc.name);
    setHpInput(String(npc.hp));
    setMaxHpInput(String(npc.maxHp));
    setInitiativeModifierInput(String(npc.initiativeModifier ?? 0));
    setPortrait(npc.portrait ?? "");
    setTokenImage(npc.tokenImage ?? "");
  }, [npc]);

  const commitUpdate = (
    overrides?: Partial<{
      name: string;
      hp: number;
      maxHp: number;
      portrait?: string;
      tokenImage?: string;
      initiativeModifier?: number;
    }>,
  ) => {
    const baseHp = overrides?.hp ?? Number(hpInput);
    const baseMaxHp = overrides?.maxHp ?? Number(maxHpInput);
    const parsedHp = Math.max(0, Number.isFinite(baseHp) ? Number(baseHp) : 0);
    const parsedMax = Math.max(1, Number.isFinite(baseMaxHp) ? Number(baseMaxHp) : 1);
    const clampedHp = Math.min(parsedMax, parsedHp);

    const baseInitMod = overrides?.initiativeModifier ?? Number(initiativeModifierInput);
    const parsedInitMod = Number.isFinite(baseInitMod) ? Number(baseInitMod) : 0;

    setHpInput(String(clampedHp));
    setMaxHpInput(String(parsedMax));
    setInitiativeModifierInput(String(parsedInitMod));

    const nextNameSource = overrides?.name ?? name;
    const trimmedName = nextNameSource.trim();
    const nextPortraitSource = overrides?.portrait ?? portrait;
    const portraitValue = nextPortraitSource.trim();
    const nextTokenImageSource = overrides?.tokenImage ?? tokenImage;
    const tokenImageValue = nextTokenImageSource.trim();

    onUpdate({
      name: trimmedName.length > 0 ? trimmedName : "NPC",
      hp: clampedHp,
      maxHp: parsedMax,
      portrait: portraitValue.length > 0 ? portraitValue : undefined,
      tokenImage: tokenImageValue.length > 0 ? tokenImageValue : undefined,
      initiativeModifier: parsedInitMod,
    });
  };

  const handleNameBlur = () => commitUpdate({ name });
  const handleHpBlur = () => commitUpdate();
  const handleMaxHpBlur = () => commitUpdate();
  const handleInitiativeModifierBlur = () => commitUpdate();
  const handlePortraitBlur = async () => {
    const normalizedPortrait = await normalizeUrl(portrait);
    setPortrait(normalizedPortrait);
    commitUpdate({ portrait: normalizedPortrait });
  };
  const handleTokenImageBlur = async () => {
    const normalizedTokenImage = await normalizeUrl(tokenImage);
    setTokenImage(normalizedTokenImage);
    commitUpdate({ tokenImage: normalizedTokenImage });
  };

  return (
    <JRPGPanel variant="simple" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <StatusBanner variant="error" message={updateError ?? ""} visible={!!updateError} />
      <StatusBanner
        variant="error"
        message={tokenPlacementError ?? ""}
        visible={!!tokenPlacementError}
      />
      <StatusBanner variant="loading" message="Updating..." visible={isUpdating} />
      <StatusBanner variant="loading" message="Placing token..." visible={isPlacingToken} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameBlur();
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

      <div style={{ display: "flex", gap: "8px" }}>
        <label className="jrpg-text-small" style={{ flex: 1 }}>
          HP
          <input
            type="number"
            min={0}
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={handleHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleHpBlur();
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
        <label className="jrpg-text-small" style={{ flex: 1 }}>
          Max HP
          <input
            type="number"
            min={1}
            value={maxHpInput}
            onChange={(e) => setMaxHpInput(e.target.value)}
            onBlur={handleMaxHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMaxHpBlur();
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
        <label className="jrpg-text-small" style={{ flex: 1 }}>
          Init Mod
          <input
            type="number"
            min={-20}
            max={20}
            value={initiativeModifierInput}
            onChange={(e) => setInitiativeModifierInput(e.target.value)}
            onBlur={handleInitiativeModifierBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInitiativeModifierBlur();
            }}
            disabled={isUpdating}
            title="Initiative modifier added to d20 rolls"
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

      <label
        className="jrpg-text-small"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        Portrait URL
        <input
          type="text"
          value={portrait}
          onChange={(e) => setPortrait(e.target.value)}
          onBlur={handlePortraitBlur}
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
      {portrait && (
        <img
          src={portrait}
          alt={`${npc.name} portrait`}
          style={{
            width: "100%",
            maxHeight: "100px",
            objectFit: "cover",
            borderRadius: "4px",
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
        Token Image URL
        <input
          type="text"
          value={tokenImage}
          onChange={(e) => setTokenImage(e.target.value)}
          onBlur={handleTokenImageBlur}
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
      {tokenImage && (
        <img
          src={tokenImage}
          alt={`${npc.name} token preview`}
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

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <JRPGButton
          variant="primary"
          onClick={() => {
            commitUpdate();
            onPlace();
          }}
          disabled={isUpdating || isPlacingToken}
          style={{ fontSize: "10px", flex: 1 }}
        >
          {isPlacingToken ? "Placing..." : "Place on Map"}
        </JRPGButton>
        <JRPGButton
          variant="danger"
          onClick={onDelete}
          disabled={isUpdating || isPlacingToken}
          style={{ fontSize: "10px", flex: 1 }}
        >
          Delete
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
}
