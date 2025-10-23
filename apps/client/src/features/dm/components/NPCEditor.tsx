// ============================================================================
// NPC EDITOR COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 2: Entity Editors refactoring.
// Provides editing interface for NPC properties including name, HP, and images.

import { useState, useEffect } from "react";
import type { Character } from "@shared";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useImageUrlNormalization } from "../../../hooks/useImageUrlNormalization";

interface NPCEditorProps {
  npc: Character;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    portrait?: string;
    tokenImage?: string;
  }) => void;
  onPlace: () => void;
  onDelete: () => void;
}

export function NPCEditor({ npc, onUpdate, onPlace, onDelete }: NPCEditorProps) {
  const [name, setName] = useState(npc.name);
  const [hpInput, setHpInput] = useState(String(npc.hp));
  const [maxHpInput, setMaxHpInput] = useState(String(npc.maxHp));
  const [portrait, setPortrait] = useState(npc.portrait ?? "");
  const [tokenImage, setTokenImage] = useState(npc.tokenImage ?? "");
  const { normalizeUrl } = useImageUrlNormalization();

  useEffect(() => {
    setName(npc.name);
    setHpInput(String(npc.hp));
    setMaxHpInput(String(npc.maxHp));
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
    }>,
  ) => {
    const baseHp = overrides?.hp ?? Number(hpInput);
    const baseMaxHp = overrides?.maxHp ?? Number(maxHpInput);
    const parsedHp = Math.max(0, Number.isFinite(baseHp) ? Number(baseHp) : 0);
    const parsedMax = Math.max(1, Number.isFinite(baseMaxHp) ? Number(baseMaxHp) : 1);
    const clampedHp = Math.min(parsedMax, parsedHp);

    setHpInput(String(clampedHp));
    setMaxHpInput(String(parsedMax));

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
    });
  };

  const handleNameBlur = () => commitUpdate({ name });
  const handleHpBlur = () => commitUpdate();
  const handleMaxHpBlur = () => commitUpdate();
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
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
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
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
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
            style={{
              width: "100%",
              padding: "4px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
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
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
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
          style={{
            width: "100%",
            padding: "4px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
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
          style={{ fontSize: "10px", flex: 1 }}
        >
          Place on Map
        </JRPGButton>
        <JRPGButton variant="danger" onClick={onDelete} style={{ fontSize: "10px", flex: 1 }}>
          Delete
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
}
