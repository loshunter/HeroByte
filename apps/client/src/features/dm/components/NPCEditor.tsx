// ============================================================================
// NPC EDITOR COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 2: Entity Editors refactoring.
// Provides editing interface for NPC properties including name, HP, and images.

import { useState, useEffect } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { normalizeHPValues, parseHPInput, parseMaxHPInput } from "@herobyte/shared";
import { JRPGPanel } from "../../../components/ui/JRPGPanel";
import { ImageField } from "../../../components/ui/ImageField";
import { StatusBanner } from "../../../components/ui/StatusBanner";
import { NPCEditorActions } from "./NPCEditorActions";

interface NPCEditorProps {
  npc: SnapshotCharacter;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    tempHp?: number;
    portrait?: string;
    tokenImage?: string;
    initiativeModifier?: number;
  }) => void;
  onPlace: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  updateError?: string | null;
  isPlacingToken?: boolean;
  isDuplicating?: boolean;
  tokenPlacementError?: string | null;
}

export function NPCEditor({
  npc,
  onUpdate,
  onPlace,
  onDuplicate,
  onDelete,
  isDuplicating = false,
  isUpdating = false,
  updateError = null,
  isPlacingToken = false,
  tokenPlacementError = null,
}: NPCEditorProps) {
  const [name, setName] = useState(npc.name);
  const [hpInput, setHpInput] = useState(String(npc.hp));
  const [maxHpInput, setMaxHpInput] = useState(String(npc.maxHp));
  const [tempHpInput, setTempHpInput] = useState(String(npc.tempHp ?? 0));
  const [initiativeModifierInput, setInitiativeModifierInput] = useState(
    String(npc.initiativeModifier ?? 0),
  );
  const [portrait, setPortrait] = useState(npc.portrait ?? "");
  const [tokenImage, setTokenImage] = useState(npc.tokenImage ?? "");

  useEffect(() => {
    setName(npc.name);
    setHpInput(String(npc.hp));
    setMaxHpInput(String(npc.maxHp));
    setTempHpInput(String(npc.tempHp ?? 0));
    setInitiativeModifierInput(String(npc.initiativeModifier ?? 0));
    setPortrait(npc.portrait ?? "");
    setTokenImage(npc.tokenImage ?? "");
  }, [npc]);

  const commitUpdate = (
    overrides?: Partial<{
      name: string;
      hp: number;
      maxHp: number;
      tempHp?: number;
      portrait?: string;
      tokenImage?: string;
      initiativeModifier?: number;
    }>,
  ) => {
    // Parse HP values
    const baseHp = overrides?.hp ?? parseHPInput(hpInput, 0);
    const baseMaxHp = overrides?.maxHp ?? parseMaxHPInput(maxHpInput, 1);

    // Use new QoL validation: if HP > Max HP, auto-adjust Max HP
    const normalized = normalizeHPValues(baseHp, baseMaxHp);

    // Parse Temp HP
    const baseTempHp = overrides?.tempHp ?? parseHPInput(tempHpInput, 0);
    const parsedTempHp = Math.max(0, baseTempHp);

    // Parse Initiative Modifier
    const baseInitMod = overrides?.initiativeModifier ?? Number(initiativeModifierInput);
    const parsedInitMod = Number.isFinite(baseInitMod) ? Number(baseInitMod) : 0;
    const clampedInitMod = Math.max(-20, Math.min(20, parsedInitMod));

    // Update input fields to reflect normalized values
    setHpInput(String(normalized.hp));
    setMaxHpInput(String(normalized.maxHp));
    setTempHpInput(String(parsedTempHp));
    setInitiativeModifierInput(String(clampedInitMod));

    const nextNameSource = overrides?.name ?? name;
    const trimmedName = nextNameSource.trim();
    const nextPortraitSource = overrides?.portrait ?? portrait;
    const portraitValue = nextPortraitSource.trim();
    const nextTokenImageSource = overrides?.tokenImage ?? tokenImage;
    const tokenImageValue = nextTokenImageSource.trim();

    onUpdate({
      name: trimmedName.length > 0 ? trimmedName : "NPC",
      hp: normalized.hp,
      maxHp: normalized.maxHp,
      tempHp: parsedTempHp > 0 ? parsedTempHp : undefined,
      portrait: portraitValue.length > 0 ? portraitValue : undefined,
      tokenImage: tokenImageValue.length > 0 ? tokenImageValue : undefined,
      initiativeModifier: clampedInitMod,
    });
  };

  const handleNameBlur = () => commitUpdate({ name });
  const handleHpBlur = () => commitUpdate();
  const handleMaxHpBlur = () => commitUpdate();
  const handleTempHpBlur = () => commitUpdate();
  const handleInitiativeModifierBlur = () => commitUpdate();

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
          Temp HP
          <input
            type="number"
            min={0}
            value={tempHpInput}
            onChange={(e) => setTempHpInput(e.target.value)}
            onBlur={handleTempHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTempHpBlur();
            }}
            disabled={isUpdating}
            title="Temporary hit points absorbed before regular HP"
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

      <ImageField
        label="Portrait URL"
        value={portrait}
        onChange={setPortrait}
        onCommit={(url) => {
          setPortrait(url);
          commitUpdate({ portrait: url });
        }}
        disabled={isUpdating}
        compact
      />
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

      <ImageField
        label="Token Image URL"
        value={tokenImage}
        onChange={setTokenImage}
        onCommit={(url) => {
          setTokenImage(url);
          commitUpdate({ tokenImage: url });
        }}
        disabled={isUpdating}
        compact
      />
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

      <NPCEditorActions
        npcName={npc.name}
        onPlace={() => {
          commitUpdate();
          onPlace();
        }}
        // Commit first: duplicating copies what the SERVER holds, so an edit
        // still sitting in the form would be silently dropped from the copy.
        onDuplicate={() => {
          commitUpdate();
          onDuplicate();
        }}
        onDelete={onDelete}
        isUpdating={isUpdating}
        isPlacingToken={isPlacingToken}
        isDuplicating={isDuplicating}
      />
    </JRPGPanel>
  );
}
